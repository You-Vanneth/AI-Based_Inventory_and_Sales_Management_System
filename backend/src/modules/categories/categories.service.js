import { pool } from "../../db/pool.js";

export async function listCategories({ page = 1, limit = 20, q = "", isActive }) {
  const offset = (page - 1) * limit;
  const keyword = `%${q}%`;

  const filters = ["deleted_at IS NULL", "category_name LIKE ?"];
  const params = [keyword];

  if (isActive !== undefined) {
    filters.push("is_active = ?");
    params.push(isActive);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT category_id, category_name, description, is_active, created_at, updated_at
     FROM categories
     WHERE ${whereClause}
     ORDER BY category_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM categories
     WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function getCategory(categoryId) {
  const [rows] = await pool.query(
    `SELECT category_id, category_name, description, is_active, created_at, updated_at
     FROM categories
     WHERE category_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [categoryId]
  );
  return rows[0] || null;
}

export async function existsCategoryName(categoryName, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT category_id
     FROM categories
     WHERE category_name = ?
       AND deleted_at IS NULL
       AND (? IS NULL OR category_id <> ?)
     LIMIT 1`,
    [categoryName, excludeId, excludeId]
  );
  return Boolean(rows[0]);
}

export async function createCategory(input, actorId) {
  const [result] = await pool.query(
    `INSERT INTO categories (category_name, description, created_by, updated_by)
     VALUES (?, ?, ?, ?)`,
    [input.category_name, input.description || null, actorId, actorId]
  );
  return getCategory(result.insertId);
}

export async function updateCategory(categoryId, input, actorId) {
  const fields = [];
  const values = [];

  if (input.category_name !== undefined) {
    fields.push("category_name = ?");
    values.push(input.category_name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description);
  }
  if (input.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(input.is_active);
  }

  if (fields.length === 0) return getCategory(categoryId);

  values.push(actorId, categoryId);
  await pool.query(
    `UPDATE categories
     SET ${fields.join(", ")}, updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE category_id = ? AND deleted_at IS NULL`,
    values
  );

  return getCategory(categoryId);
}

export async function softDeleteCategory(categoryId, actorId) {
  await pool.query(
    `UPDATE categories
     SET deleted_at = CURRENT_TIMESTAMP,
         is_active = 0,
         updated_by = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE category_id = ? AND deleted_at IS NULL`,
    [actorId, categoryId]
  );
}
