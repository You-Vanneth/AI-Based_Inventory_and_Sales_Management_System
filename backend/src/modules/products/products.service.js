import { pool } from "../../db/pool.js";

export async function listProducts({ page = 1, limit = 20, q = "", categoryId, lowStockOnly }) {
  const offset = (page - 1) * limit;
  const keyword = `%${q}%`;

  const filters = ["p.deleted_at IS NULL", "(p.product_name LIKE ? OR p.barcode LIKE ?)"];
  const params = [keyword, keyword];

  if (categoryId) {
    filters.push("p.category_id = ?");
    params.push(categoryId);
  }

  if (lowStockOnly) {
    filters.push("p.quantity <= p.min_stock_level");
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.category_id,
            c.category_name, p.quantity, p.min_stock_level,
            p.cost_price, p.selling_price, p.expiry_date,
            p.created_at, p.updated_at
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE ${whereClause}
     ORDER BY p.product_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM products p
     WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function getProduct(productId) {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.category_id,
            c.category_name, p.quantity, p.min_stock_level,
            p.cost_price, p.selling_price, p.expiry_date,
            p.created_at, p.updated_at
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE p.product_id = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [productId]
  );
  return rows[0] || null;
}

export async function getProductByBarcode(barcode) {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.category_id,
            c.category_name, p.quantity, p.min_stock_level,
            p.cost_price, p.selling_price, p.expiry_date,
            p.created_at, p.updated_at
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE p.barcode = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [barcode]
  );
  return rows[0] || null;
}

export async function existsProductBarcode(barcode, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT product_id
     FROM products
     WHERE barcode = ?
       AND deleted_at IS NULL
       AND (? IS NULL OR product_id <> ?)
     LIMIT 1`,
    [barcode, excludeId, excludeId]
  );
  return Boolean(rows[0]);
}

export async function categoryExists(categoryId) {
  const [rows] = await pool.query(
    `SELECT category_id FROM categories WHERE category_id = ? AND deleted_at IS NULL LIMIT 1`,
    [categoryId]
  );
  return Boolean(rows[0]);
}

export async function createProduct(input, actorId) {
  const [result] = await pool.query(
    `INSERT INTO products (
      product_name, barcode, category_id, quantity, min_stock_level,
      cost_price, selling_price, expiry_date, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.product_name,
      input.barcode,
      input.category_id,
      input.quantity,
      input.min_stock_level,
      input.cost_price,
      input.selling_price,
      input.expiry_date || null,
      actorId,
      actorId
    ]
  );
  return getProduct(result.insertId);
}

export async function updateProduct(productId, input, actorId) {
  const fields = [];
  const values = [];

  const allowed = [
    "product_name",
    "barcode",
    "category_id",
    "min_stock_level",
    "cost_price",
    "selling_price",
    "expiry_date"
  ];

  for (const key of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key]);
    }
  }

  if (fields.length === 0) return getProduct(productId);

  values.push(actorId, productId);
  await pool.query(
    `UPDATE products
     SET ${fields.join(", ")}, updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE product_id = ? AND deleted_at IS NULL`,
    values
  );

  return getProduct(productId);
}

export async function softDeleteProduct(productId, actorId) {
  await pool.query(
    `UPDATE products
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE product_id = ? AND deleted_at IS NULL`,
    [actorId, productId]
  );
}

export async function adjustStock(productId, { adjustment_type, quantity, reason }, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT product_id, quantity, cost_price
       FROM products
       WHERE product_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [productId]
    );

    const product = rows[0];
    if (!product) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      err.errorCode = "PRODUCT_NOT_FOUND";
      throw err;
    }

    const qtyBefore = Number(product.quantity);
    const delta = adjustment_type === "ADJUSTMENT_IN" ? quantity : -quantity;
    const qtyAfter = qtyBefore + delta;

    if (qtyAfter < 0) {
      const err = new Error("Insufficient stock for adjustment");
      err.statusCode = 409;
      err.errorCode = "INSUFFICIENT_STOCK";
      throw err;
    }

    await connection.query(
      `UPDATE products
       SET quantity = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = ?`,
      [qtyAfter, actorId, productId]
    );

    await connection.query(
      `INSERT INTO inventory_movements (
        product_id, movement_type, qty_change, qty_before, qty_after,
        unit_cost, reference_type, reference_id, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'MANUAL_ADJUSTMENT', NULL, ?, ?)`,
      [
        productId,
        adjustment_type,
        delta,
        qtyBefore,
        qtyAfter,
        product.cost_price,
        reason,
        actorId
      ]
    );

    await connection.commit();
    return getProduct(productId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
