import { pool } from "../db/pool.js";

export async function writeSystemLog({ actorUserId = null, actionType, entityType, entityId = null, details = null, ipAddress = null }) {
  try {
    await pool.query(
      `INSERT INTO system_logs (actor_user_id, action_type, entity_type, entity_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorUserId,
        actionType,
        entityType,
        entityId,
        details ? JSON.stringify(details) : null,
        ipAddress
      ]
    );
  } catch (error) {
    // Never block app flow due to logging failures.
    console.error("System log write failed", error?.message || error);
  }
}
