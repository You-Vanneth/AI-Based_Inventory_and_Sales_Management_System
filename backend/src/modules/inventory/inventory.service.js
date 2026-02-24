import { pool } from "../../db/pool.js";

export async function listMovements({ page = 1, limit = 20, productId, movementType, dateFrom, dateTo }) {
  const offset = (page - 1) * limit;
  const filters = ["1=1"];
  const params = [];

  if (productId) {
    filters.push("im.product_id = ?");
    params.push(Number(productId));
  }

  if (movementType) {
    filters.push("im.movement_type = ?");
    params.push(movementType);
  }

  if (dateFrom) {
    filters.push("DATE(im.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    filters.push("DATE(im.created_at) <= ?");
    params.push(dateTo);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT im.movement_id, im.product_id, p.product_name, p.barcode,
            im.movement_type, im.qty_change, im.qty_before, im.qty_after,
            im.unit_cost, im.reference_type, im.reference_id, im.reason,
            im.created_by, u.full_name AS created_by_name, im.created_at
     FROM inventory_movements im
     JOIN products p ON p.product_id = im.product_id
     LEFT JOIN users u ON u.user_id = im.created_by
     WHERE ${whereClause}
     ORDER BY im.created_at DESC, im.movement_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM inventory_movements im
     WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRow.total };
}

export async function getMovementById(movementId) {
  const [rows] = await pool.query(
    `SELECT im.movement_id, im.product_id, p.product_name, p.barcode,
            im.movement_type, im.qty_change, im.qty_before, im.qty_after,
            im.unit_cost, im.reference_type, im.reference_id, im.reason,
            im.created_by, u.full_name AS created_by_name, im.created_at
     FROM inventory_movements im
     JOIN products p ON p.product_id = im.product_id
     LEFT JOIN users u ON u.user_id = im.created_by
     WHERE im.movement_id = ?
     LIMIT 1`,
    [movementId]
  );

  return rows[0] || null;
}
