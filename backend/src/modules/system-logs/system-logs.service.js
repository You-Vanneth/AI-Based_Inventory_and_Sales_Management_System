import { pool } from "../../db/pool.js";

export async function listSystemLogs({ page = 1, limit = 20, actionType, entityType, dateFrom, dateTo }) {
  const offset = (page - 1) * limit;
  const filters = ["1=1"];
  const params = [];

  if (actionType) {
    filters.push("sl.action_type = ?");
    params.push(actionType);
  }
  if (entityType) {
    filters.push("sl.entity_type = ?");
    params.push(entityType);
  }
  if (dateFrom) {
    filters.push("DATE(sl.created_at) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(sl.created_at) <= ?");
    params.push(dateTo);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT sl.log_id, sl.actor_user_id, u.full_name AS actor_name,
            sl.action_type, sl.entity_type, sl.entity_id,
            sl.details_json, sl.ip_address, sl.created_at
     FROM system_logs sl
     LEFT JOIN users u ON u.user_id = sl.actor_user_id
     WHERE ${whereClause}
     ORDER BY sl.created_at DESC, sl.log_id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM system_logs sl WHERE ${whereClause}`,
    params
  );

  return { rows, total: countRow.total };
}

export async function getSystemLogById(logId) {
  const [rows] = await pool.query(
    `SELECT sl.log_id, sl.actor_user_id, u.full_name AS actor_name,
            sl.action_type, sl.entity_type, sl.entity_id,
            sl.details_json, sl.ip_address, sl.created_at
     FROM system_logs sl
     LEFT JOIN users u ON u.user_id = sl.actor_user_id
     WHERE sl.log_id = ?
     LIMIT 1`,
    [logId]
  );

  return rows[0] || null;
}
