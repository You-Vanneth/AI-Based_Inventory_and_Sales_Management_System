import { pool } from "../../db/pool.js";

function mapRolePermissions(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.role_id)) {
      map.set(row.role_id, {
        role_id: row.role_id,
        role_code: row.role_code,
        role_name: row.role_name,
        description: row.description,
        is_system: row.is_system,
        is_active: row.is_active,
        permissions: []
      });
    }

    if (row.permission_key) {
      map.get(row.role_id).permissions.push({
        permission_key: row.permission_key,
        permission_name: row.permission_name,
        module_name: row.module_name
      });
    }
  }

  return Array.from(map.values());
}

export async function listPermissions() {
  const [rows] = await pool.query(
    `SELECT permission_id, permission_key, permission_name, module_name
     FROM permissions
     ORDER BY module_name ASC, permission_name ASC`
  );
  return rows;
}

export async function listRoles({ activeOnly = false } = {}) {
  const filters = ["r.deleted_at IS NULL"];
  const params = [];

  if (activeOnly) {
    filters.push("r.is_active = 1");
  }

  const [rows] = await pool.query(
    `SELECT r.role_id, r.role_code, r.role_name, r.description, r.is_system, r.is_active,
            p.permission_key, p.permission_name, p.module_name
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
     LEFT JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE ${filters.join(" AND ")}
     ORDER BY r.is_system DESC, r.role_name ASC, p.module_name ASC, p.permission_name ASC`,
    params
  );

  return mapRolePermissions(rows);
}

export async function getRoleById(roleId) {
  const roles = await listRoles();
  return roles.find((r) => r.role_id === roleId) || null;
}

export async function getRoleByCode(roleCode) {
  const [rows] = await pool.query(
    `SELECT role_id, role_code, role_name, description, is_system, is_active
     FROM roles
     WHERE role_code = ? AND deleted_at IS NULL
     LIMIT 1`,
    [roleCode]
  );
  return rows[0] || null;
}

export async function createRole({ role_code, role_name, description = null, permission_keys = [] }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `INSERT INTO roles (role_code, role_name, description, is_system, is_active)
       VALUES (?, ?, ?, 0, 1)`,
      [role_code, role_name, description]
    );

    if (permission_keys.length > 0) {
      const [permissionRows] = await connection.query(
        `SELECT permission_id, permission_key
         FROM permissions
         WHERE permission_key IN (${permission_keys.map(() => "?").join(",")})`,
        permission_keys
      );

      if (permissionRows.length !== permission_keys.length) {
        throw new Error("One or more permission keys are invalid");
      }

      for (const row of permissionRows) {
        await connection.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [insertResult.insertId, row.permission_id]
        );
      }
    }

    await connection.commit();

    const [rows] = await pool.query(
      `SELECT role_id FROM roles WHERE role_id = ? LIMIT 1`,
      [insertResult.insertId]
    );

    return getRoleById(rows[0].role_id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRole(roleId, payload) {
  const current = await getRoleById(roleId);
  if (!current) return null;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const fields = [];
    const values = [];

    if (payload.role_name !== undefined) {
      fields.push("role_name = ?");
      values.push(payload.role_name);
    }

    if (payload.description !== undefined) {
      fields.push("description = ?");
      values.push(payload.description || null);
    }

    if (payload.is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(payload.is_active);
    }

    if (fields.length > 0) {
      values.push(roleId);
      await connection.query(
        `UPDATE roles
         SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE role_id = ? AND deleted_at IS NULL`,
        values
      );
    }

    if (payload.permission_keys !== undefined) {
      if (payload.permission_keys.length > 0) {
        const [permissionRows] = await connection.query(
          `SELECT permission_id, permission_key
           FROM permissions
           WHERE permission_key IN (${payload.permission_keys.map(() => "?").join(",")})`,
          payload.permission_keys
        );

        if (permissionRows.length !== payload.permission_keys.length) {
          throw new Error("One or more permission keys are invalid");
        }

        await connection.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

        for (const row of permissionRows) {
          await connection.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
            [roleId, row.permission_id]
          );
        }
      } else {
        await connection.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
      }
    }

    await connection.commit();
    return getRoleById(roleId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deactivateRole(roleId) {
  const [result] = await pool.query(
    `UPDATE roles
     SET is_active = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE role_id = ? AND is_system = 0 AND deleted_at IS NULL`,
    [roleId]
  );

  return result.affectedRows > 0;
}

export async function roleCodeExists(roleCode, excludeRoleId = null) {
  const params = [roleCode];
  let where = "role_code = ? AND deleted_at IS NULL";

  if (excludeRoleId) {
    where += " AND role_id <> ?";
    params.push(excludeRoleId);
  }

  const [rows] = await pool.query(
    `SELECT role_id FROM roles WHERE ${where} LIMIT 1`,
    params
  );
  return Boolean(rows[0]);
}

export async function roleNameExists(roleName, excludeRoleId = null) {
  const params = [roleName];
  let where = "role_name = ? AND deleted_at IS NULL";

  if (excludeRoleId) {
    where += " AND role_id <> ?";
    params.push(excludeRoleId);
  }

  const [rows] = await pool.query(
    `SELECT role_id FROM roles WHERE ${where} LIMIT 1`,
    params
  );
  return Boolean(rows[0]);
}

export async function countUsersByRoleId(roleId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE role_id = ? AND deleted_at IS NULL`,
    [roleId]
  );

  return Number(rows[0]?.total || 0);
}
