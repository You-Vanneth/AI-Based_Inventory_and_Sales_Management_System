import { pool } from "../../db/pool.js";

function round2(n) {
  return Number(n.toFixed(2));
}

export async function listPurchaseOrders({ page = 1, limit = 20, status }) {
  const offset = (page - 1) * limit;
  const filters = ["po.deleted_at IS NULL"];
  const params = [];

  if (status) {
    filters.push("po.status = ?");
    params.push(status);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT po.purchase_order_id, po.po_number, po.supplier_name, po.status,
            po.order_date, po.expected_date, po.received_date, po.grand_total,
            po.created_at
     FROM purchase_orders po
     WHERE ${whereClause}
     ORDER BY po.created_at DESC, po.purchase_order_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM purchase_orders po
     WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRow.total };
}

export async function getPurchaseOrderById(purchaseOrderId) {
  const [rows] = await pool.query(
    `SELECT purchase_order_id, po_number, supplier_name, supplier_phone, supplier_email,
            status, order_date, expected_date, received_date,
            subtotal, discount_total, tax_total, grand_total,
            notes, created_by, updated_by, created_at, updated_at
     FROM purchase_orders
     WHERE purchase_order_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [purchaseOrderId]
  );

  const po = rows[0] || null;
  if (!po) return null;

  const [items] = await pool.query(
    `SELECT poi.purchase_order_item_id, poi.product_id, p.product_name, p.barcode,
            poi.quantity_ordered, poi.quantity_received,
            poi.unit_cost, poi.line_total, poi.expiry_date
     FROM purchase_order_items poi
     JOIN products p ON p.product_id = poi.product_id
     WHERE poi.purchase_order_id = ? AND poi.deleted_at IS NULL
     ORDER BY poi.purchase_order_item_id ASC`,
    [purchaseOrderId]
  );

  return { ...po, items };
}

async function productsExist(connection, productIds) {
  const placeholders = productIds.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT product_id FROM products WHERE deleted_at IS NULL AND product_id IN (${placeholders})`,
    productIds
  );
  return rows.length === productIds.length;
}

export async function createPurchaseOrder(input, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const productIds = [...new Set(input.items.map((i) => i.product_id))];
    const allExist = await productsExist(connection, productIds);
    if (!allExist) {
      const err = new Error("One or more products not found");
      err.statusCode = 404;
      err.errorCode = "PRODUCT_NOT_FOUND";
      throw err;
    }

    let subtotal = 0;
    const normalizedItems = input.items.map((i) => {
      const lineTotal = round2(Number(i.unit_cost) * Number(i.quantity_ordered));
      subtotal += lineTotal;
      return {
        ...i,
        unit_cost: Number(i.unit_cost),
        line_total: lineTotal
      };
    });

    subtotal = round2(subtotal);
    const discountTotal = 0;
    const taxTotal = 0;
    const grandTotal = round2(subtotal - discountTotal + taxTotal);

    const [poResult] = await connection.query(
      `INSERT INTO purchase_orders (
        po_number, supplier_name, supplier_phone, supplier_email,
        status, order_date, expected_date,
        subtotal, discount_total, tax_total, grand_total,
        notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.po_number,
        input.supplier_name,
        input.supplier_phone || null,
        input.supplier_email || null,
        input.order_date,
        input.expected_date || null,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        input.notes || null,
        actorId,
        actorId
      ]
    );

    const purchaseOrderId = poResult.insertId;

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO purchase_order_items (
          purchase_order_id, product_id,
          quantity_ordered, quantity_received,
          unit_cost, line_total, expiry_date
        ) VALUES (?, ?, ?, 0, ?, ?, ?)`,
        [
          purchaseOrderId,
          item.product_id,
          item.quantity_ordered,
          item.unit_cost,
          item.line_total,
          item.expiry_date || null
        ]
      );
    }

    await connection.commit();
    return getPurchaseOrderById(purchaseOrderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updatePurchaseOrder(purchaseOrderId, input, actorId) {
  const fields = [];
  const values = [];

  const allowed = ["supplier_name", "supplier_phone", "supplier_email", "expected_date", "notes"];

  for (const key of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key]);
    }
  }

  if (fields.length > 0) {
    values.push(actorId, purchaseOrderId);
    await pool.query(
      `UPDATE purchase_orders
       SET ${fields.join(", ")}, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE purchase_order_id = ?
         AND deleted_at IS NULL
         AND status IN ('DRAFT','APPROVED')`,
      values
    );
  }

  return getPurchaseOrderById(purchaseOrderId);
}

export async function approvePurchaseOrder(purchaseOrderId, actorId) {
  await pool.query(
    `UPDATE purchase_orders
     SET status = 'APPROVED', updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE purchase_order_id = ?
       AND deleted_at IS NULL
       AND status = 'DRAFT'`,
    [actorId, purchaseOrderId]
  );

  return getPurchaseOrderById(purchaseOrderId);
}

export async function cancelPurchaseOrder(purchaseOrderId, actorId) {
  await pool.query(
    `UPDATE purchase_orders
     SET status = 'CANCELLED', updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE purchase_order_id = ?
       AND deleted_at IS NULL
       AND status IN ('DRAFT','APPROVED')`,
    [actorId, purchaseOrderId]
  );

  return getPurchaseOrderById(purchaseOrderId);
}

export async function receivePurchaseOrder(purchaseOrderId, payload, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [poRows] = await connection.query(
      `SELECT purchase_order_id, status
       FROM purchase_orders
       WHERE purchase_order_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [purchaseOrderId]
    );

    const po = poRows[0];
    if (!po) {
      const err = new Error("Purchase order not found");
      err.statusCode = 404;
      err.errorCode = "PURCHASE_ORDER_NOT_FOUND";
      throw err;
    }

    if (!['APPROVED','DRAFT'].includes(po.status)) {
      const err = new Error("Purchase order cannot be received in current status");
      err.statusCode = 409;
      err.errorCode = "PURCHASE_ORDER_INVALID_STATUS";
      throw err;
    }

    for (const row of payload.items) {
      const [poiRows] = await connection.query(
        `SELECT purchase_order_item_id, product_id, quantity_ordered, quantity_received,
                unit_cost, expiry_date
         FROM purchase_order_items
         WHERE purchase_order_item_id = ?
           AND purchase_order_id = ?
           AND deleted_at IS NULL
         FOR UPDATE`,
        [row.purchase_order_item_id, purchaseOrderId]
      );

      const poi = poiRows[0];
      if (!poi) {
        const err = new Error("Purchase order item not found");
        err.statusCode = 404;
        err.errorCode = "PURCHASE_ORDER_ITEM_NOT_FOUND";
        throw err;
      }

      const nextReceived = Number(poi.quantity_received) + Number(row.quantity_received);
      if (nextReceived > Number(poi.quantity_ordered)) {
        const err = new Error("Received quantity exceeds ordered quantity");
        err.statusCode = 409;
        err.errorCode = "RECEIVE_QTY_EXCEEDS_ORDERED";
        throw err;
      }

      await connection.query(
        `UPDATE purchase_order_items
         SET quantity_received = ?,
             expiry_date = COALESCE(?, expiry_date),
             updated_at = CURRENT_TIMESTAMP
         WHERE purchase_order_item_id = ?`,
        [nextReceived, row.expiry_date || null, poi.purchase_order_item_id]
      );

      const [productRows] = await connection.query(
        `SELECT product_id, quantity, cost_price
         FROM products
         WHERE product_id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [poi.product_id]
      );

      const product = productRows[0];
      if (!product) {
        const err = new Error("Product not found");
        err.statusCode = 404;
        err.errorCode = "PRODUCT_NOT_FOUND";
        throw err;
      }

      const qtyBefore = Number(product.quantity);
      const qtyAfter = qtyBefore + Number(row.quantity_received);

      await connection.query(
        `UPDATE products
         SET quantity = ?,
             cost_price = ?,
             expiry_date = COALESCE(?, expiry_date),
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [
          qtyAfter,
          Number(poi.unit_cost),
          row.expiry_date || null,
          actorId,
          poi.product_id
        ]
      );

      await connection.query(
        `INSERT INTO inventory_movements (
          product_id, movement_type, qty_change, qty_before, qty_after,
          unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, 'PURCHASE_IN', ?, ?, ?, ?, 'PURCHASE_ORDER', ?, ?, ?)`,
        [
          poi.product_id,
          Number(row.quantity_received),
          qtyBefore,
          qtyAfter,
          Number(poi.unit_cost),
          purchaseOrderId,
          'Purchase order receiving',
          actorId
        ]
      );
    }

    await connection.query(
      `UPDATE purchase_orders
       SET status = 'RECEIVED',
           received_date = ?,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE purchase_order_id = ?`,
      [payload.received_date, actorId, purchaseOrderId]
    );

    await connection.commit();
    return getPurchaseOrderById(purchaseOrderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
