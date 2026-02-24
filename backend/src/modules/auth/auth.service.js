import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool.js";
import { env } from "../../config/env.js";

async function getPermissionsByRoleId(roleId) {
  if (!roleId) return [];

  const [rows] = await pool.query(
    `SELECT p.permission_key
     FROM role_permissions rp
     JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE rp.role_id = ?
     ORDER BY p.permission_key ASC`,
    [roleId]
  );

  return rows.map((r) => r.permission_key);
}

export async function findActiveUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role, u.role_id, u.is_active, u.deleted_at,
            COALESCE(r.role_code, u.role) AS role_code,
            COALESCE(r.role_name, u.role) AS role_name
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id AND r.deleted_at IS NULL
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );

  const user = rows[0];
  if (!user || user.deleted_at || user.is_active !== 1) return null;

  const permissions = await getPermissionsByRoleId(user.role_id);
  return { ...user, permissions };
}

export async function findUserById(userId) {
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

  const user = rows[0] || null;
  if (!user) return null;

  const permissions = await getPermissionsByRoleId(user.role_id);
  return { ...user, permissions };
}

export async function createUser({ full_name, email, password, role = "STAFF" }) {
  const password_hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [full_name, email, password_hash, role]
  );
  return findUserById(result.insertId);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function issueAccessToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role: user.role_code || user.role,
      role_id: user.role_id || null,
      email: user.email,
      permissions: user.permissions || []
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function changePassword(userId, newPassword) {
  const password_hash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users
     SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND deleted_at IS NULL`,
    [password_hash, userId]
  );
}
