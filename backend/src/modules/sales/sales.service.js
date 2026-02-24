import { pool } from "../../db/pool.js";

function round2(n) {
  return Number(n.toFixed(2));
}

function computePaymentStatus(totalPaid, grandTotal) {
  if (totalPaid <= 0) return "PENDING";
  if (totalPaid >= grandTotal) return "PAID";
  return "PARTIAL";
}

export async function listSales({ page = 1, limit = 20, dateFrom, dateTo }) {
  const offset = (page - 1) * limit;
  const filters = ["s.deleted_at IS NULL"];
  const params = [];

  if (dateFrom) {
    filters.push("DATE(s.sale_datetime) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(s.sale_datetime) <= ?");
    params.push(dateTo);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT s.sale_id, s.sold_by, u.full_name AS sold_by_name, s.payment_status,
            s.subtotal, s.discount_total, s.tax_total, s.grand_total,
            s.sale_datetime, s.notes, s.created_at
     FROM sales s
     JOIN users u ON u.user_id = s.sold_by
     WHERE ${whereClause}
     ORDER BY s.sale_datetime DESC, s.sale_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM sales s WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function getSaleById(saleId) {
  const [saleRows] = await pool.query(
    `SELECT s.sale_id, s.sold_by, u.full_name AS sold_by_name, s.payment_status,
            s.subtotal, s.discount_total, s.tax_total, s.grand_total,
            s.sale_datetime, s.notes, s.created_at
     FROM sales s
     JOIN users u ON u.user_id = s.sold_by
     WHERE s.sale_id = ? AND s.deleted_at IS NULL
     LIMIT 1`,
    [saleId]
  );

  const sale = saleRows[0];
  if (!sale) return null;

  const [items] = await pool.query(
    `SELECT si.sale_item_id, si.product_id, p.product_name, p.barcode,
            si.quantity_sold, si.unit_cost, si.unit_price, si.discount_amount, si.line_total
     FROM sale_items si
     JOIN products p ON p.product_id = si.product_id
     WHERE si.sale_id = ? AND si.deleted_at IS NULL
     ORDER BY si.sale_item_id ASC`,
    [saleId]
  );

  const [payments] = await pool.query(
    `SELECT payment_id, payment_method, amount, paid_at, reference_no, note
     FROM payments
     WHERE sale_id = ? AND deleted_at IS NULL
     ORDER BY payment_id ASC`,
    [saleId]
  );

  return { ...sale, items, payments };
}

export async function createSale(input, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const productIds = [...new Set(input.items.map((i) => i.product_id))];
    const placeholders = productIds.map(() => "?").join(", ");

    const [productRows] = await connection.query(
      `SELECT product_id, product_name, quantity, cost_price, selling_price
       FROM products
       WHERE deleted_at IS NULL AND product_id IN (${placeholders})
       FOR UPDATE`,
      productIds
    );

    if (productRows.length !== productIds.length) {
      const err = new Error("One or more products not found");
      err.statusCode = 404;
      err.errorCode = "PRODUCT_NOT_FOUND";
      throw err;
    }

    const productMap = new Map(productRows.map((p) => [p.product_id, p]));
    const remainingQtyByProduct = new Map(productRows.map((p) => [p.product_id, Number(p.quantity)]));

    let subtotal = 0;
    let discountTotal = 0;
    const saleItems = [];

    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      const qtyBefore = remainingQtyByProduct.get(item.product_id);
      const qtyAfter = qtyBefore - item.quantity_sold;

      if (qtyBefore < item.quantity_sold) {
        const err = new Error(`Insufficient stock for product ${product.product_name}`);
        err.statusCode = 409;
        err.errorCode = "INSUFFICIENT_STOCK";
        throw err;
      }

      const unitPrice = Number(item.unit_price ?? product.selling_price);
      const itemDiscount = Number(item.discount_amount || 0);
      const lineTotal = round2(item.quantity_sold * unitPrice - itemDiscount);
      if (lineTotal < 0) {
        const err = new Error("Discount cannot exceed line amount");
        err.statusCode = 422;
        err.errorCode = "INVALID_DISCOUNT";
        throw err;
      }

      subtotal += round2(item.quantity_sold * unitPrice);
      discountTotal += itemDiscount;

      saleItems.push({
        product,
        product_id: item.product_id,
        quantity_sold: item.quantity_sold,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        unit_cost: Number(product.cost_price),
        unit_price: unitPrice,
        discount_amount: itemDiscount,
        line_total: lineTotal
      });

      remainingQtyByProduct.set(item.product_id, qtyAfter);
    }

    subtotal = round2(subtotal);
    discountTotal = round2(discountTotal);
    const taxTotal = 0;
    const grandTotal = round2(subtotal - discountTotal + taxTotal);

    const totalPaid = round2((input.payments || []).reduce((acc, p) => acc + Number(p.amount), 0));
    const paymentStatus = computePaymentStatus(totalPaid, grandTotal);

    const [saleResult] = await connection.query(
      `INSERT INTO sales (
        sold_by, payment_status, subtotal, discount_total, tax_total,
        grand_total, sale_datetime, notes
      ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)`,
      [
        actorId,
        paymentStatus,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        input.sale_datetime || null,
        input.notes || null
      ]
    );

    const saleId = saleResult.insertId;

    for (const si of saleItems) {
      await connection.query(
        `INSERT INTO sale_items (
          sale_id, product_id, quantity_sold, unit_cost,
          unit_price, discount_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          si.product_id,
          si.quantity_sold,
          si.unit_cost,
          si.unit_price,
          si.discount_amount,
          si.line_total
        ]
      );

      await connection.query(
        `UPDATE products
         SET quantity = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [si.qty_after, actorId, si.product_id]
      );

      await connection.query(
        `INSERT INTO inventory_movements (
          product_id, movement_type, qty_change, qty_before, qty_after,
          unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, 'SALE_OUT', ?, ?, ?, ?, 'SALE', ?, ?, ?)`,
        [
          si.product_id,
          -si.quantity_sold,
          si.qty_before,
          si.qty_after,
          si.unit_cost,
          saleId,
          'Sale transaction',
          actorId
        ]
      );
    }

    for (const payment of input.payments || []) {
      await connection.query(
        `INSERT INTO payments (
          sale_id, payment_method, amount, paid_at, reference_no, received_by, note
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
        [
          saleId,
          payment.payment_method,
          Number(payment.amount),
          payment.reference_no || null,
          actorId,
          payment.note || null
        ]
      );
    }

    await connection.commit();
    return getSaleById(saleId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function voidSale(saleId, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [saleRows] = await connection.query(
      `SELECT sale_id FROM sales WHERE sale_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [saleId]
    );

    if (!saleRows[0]) {
      const err = new Error("Sale not found");
      err.statusCode = 404;
      err.errorCode = "SALE_NOT_FOUND";
      throw err;
    }

    const [items] = await connection.query(
      `SELECT sale_item_id, product_id, quantity_sold, unit_cost
       FROM sale_items
       WHERE sale_id = ? AND deleted_at IS NULL`,
      [saleId]
    );

    for (const item of items) {
      const [productRows] = await connection.query(
        `SELECT quantity FROM products WHERE product_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [item.product_id]
      );
      const product = productRows[0];
      if (!product) continue;

      const qtyBefore = Number(product.quantity);
      const qtyAfter = qtyBefore + Number(item.quantity_sold);

      await connection.query(
        `UPDATE products
         SET quantity = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [qtyAfter, actorId, item.product_id]
      );

      await connection.query(
        `INSERT INTO inventory_movements (
          product_id, movement_type, qty_change, qty_before, qty_after,
          unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, 'RETURN_IN', ?, ?, ?, ?, 'SALE', ?, ?, ?)`,
        [
          item.product_id,
          item.quantity_sold,
          qtyBefore,
          qtyAfter,
          item.unit_cost,
          saleId,
          'Sale void reversal',
          actorId
        ]
      );
    }

    await connection.query(
      `UPDATE sale_items
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE sale_id = ? AND deleted_at IS NULL`,
      [saleId]
    );

    await connection.query(
      `UPDATE payments
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE sale_id = ? AND deleted_at IS NULL`,
      [saleId]
    );

    await connection.query(
      `UPDATE sales
       SET deleted_at = CURRENT_TIMESTAMP,
           payment_status = 'PENDING',
           updated_at = CURRENT_TIMESTAMP,
           notes = CONCAT(COALESCE(notes, ''), IF(COALESCE(notes, '') = '', '', ' | '), 'Voided by user ', ?)
       WHERE sale_id = ?`,
      [actorId, saleId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
