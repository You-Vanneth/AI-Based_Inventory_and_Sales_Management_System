import bcrypt from "bcrypt";
import { pool } from "../../db/pool.js";

async function getRoleById(roleId) {
  const [rows] = await pool.query(
    `SELECT role_id, role_code, role_name, is_active
     FROM roles
     WHERE role_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [roleId]
  );

  return rows[0] || null;
}

async function getRoleByCode(roleCode) {
  const [rows] = await pool.query(
    `SELECT role_id, role_code, role_name, is_active
     FROM roles
     WHERE role_code = ? AND deleted_at IS NULL
     LIMIT 1`,
    [roleCode]
  );

  return rows[0] || null;
}

async function resolveRoleInput(input) {
  if (input.role_id !== undefined) {
    const role = await getRoleById(input.role_id);
    if (!role || role.is_active !== 1) {
      throw new Error("Invalid role_id");
    }
    return role;
  }

  if (input.role !== undefined) {
    const role = await getRoleByCode(input.role);
    if (!role || role.is_active !== 1) {
      throw new Error("Invalid role");
    }
    return role;
  }

  const fallback = await getRoleByCode("STAFF");
  return fallback;
}

function toLegacyRole(roleCode) {
  return roleCode === "ADMIN" ? "ADMIN" : "STAFF";
}

export async function listUsers({ page = 1, limit = 20, q = "" }) {
  const offset = (page - 1) * limit;
  const keyword = `%${q}%`;

  const [rows] = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.role_id, u.is_active, u.created_at, u.updated_at,
            COALESCE(r.role_code, u.role) AS role_code,
            COALESCE(r.role_name, u.role) AS role_name
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id AND r.deleted_at IS NULL
     WHERE u.deleted_at IS NULL
       AND (u.full_name LIKE ? OR u.email LIKE ?)
     ORDER BY u.user_id DESC
     LIMIT ? OFFSET ?`,
    [keyword, keyword, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE deleted_at IS NULL
       AND (full_name LIKE ? OR email LIKE ?)`,
    [keyword, keyword]
  );

  return { rows, total: countRows[0].total };
}

export async function getUser(userId) {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.role_id, u.is_active, u.created_at, u.updated_at,
            COALESCE(r.role_code, u.role) AS role_code,
            COALESCE(r.role_name, u.role) AS role_name
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id AND r.deleted_at IS NULL
     WHERE u.user_id = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function createUser(input) {
  const role = await resolveRoleInput(input);
  if (!role) {
    throw new Error("Default STAFF role is missing");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, role_id)
     VALUES (?, ?, ?, ?, ?)`,
    [input.full_name, input.email, passwordHash, toLegacyRole(role.role_code), role.role_id]
  );

  return getUser(result.insertId);
}

export async function updateUser(userId, input) {
  const fields = [];
  const values = [];

  if (input.full_name !== undefined) {
    fields.push("full_name = ?");
    values.push(input.full_name);
  }

  if (input.email !== undefined) {
    fields.push("email = ?");
    values.push(input.email);
  }

  if (input.role_id !== undefined || input.role !== undefined) {
    const role = await resolveRoleInput(input);
    fields.push("role_id = ?");
    values.push(role.role_id);
    fields.push("role = ?");
    values.push(toLegacyRole(role.role_code));
  }

  if (input.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(input.is_active);
  }

  if (fields.length === 0) return getUser(userId);

  values.push(userId);
  await pool.query(
    `UPDATE users
     SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND deleted_at IS NULL`,
    values
  );

  return getUser(userId);
}

export async function updateUserStatus(userId, isActive) {
  await pool.query(
    `UPDATE users
     SET is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND deleted_at IS NULL`,
    [isActive, userId]
  );
  return getUser(userId);
}

export async function softDeleteUser(userId) {
  await pool.query(
    `UPDATE users
     SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  );
}

export async function existsEmail(email, excludeUserId = null) {
  const params = [email];
  let sql = `SELECT user_id FROM users WHERE email = ? AND deleted_at IS NULL`;
  if (excludeUserId) {
    sql += ` AND user_id <> ?`;
    params.push(excludeUserId);
  }
  sql += ` LIMIT 1`;

  const [rows] = await pool.query(sql, params);
  return Boolean(rows[0]);
}

export async function resetUserPassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users
     SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND deleted_at IS NULL`,
    [passwordHash, userId]
  );
}
