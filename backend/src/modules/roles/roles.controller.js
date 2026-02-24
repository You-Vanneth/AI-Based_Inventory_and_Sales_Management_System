import { fail, created, ok } from "../../utils/http.js";
import { createRoleSchema, updateRoleSchema } from "./roles.validator.js";
import {
  countUsersByRoleId,
  createRole,
  deactivateRole,
  getRoleById,
  listPermissions,
  listRoles,
  roleCodeExists,
  roleNameExists,
  updateRole
} from "./roles.service.js";

export async function list(req, res) {
  const activeOnly = req.query.active === "1";
  const roles = await listRoles({ activeOnly });
  return ok(res, roles, "Roles fetched");
}

export async function listAllPermissions(req, res) {
  const permissions = await listPermissions();
  return ok(res, permissions, "Permissions fetched");
}

export async function create(req, res) {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  if (await roleCodeExists(parsed.data.role_code)) {
    return fail(res, 409, "Role code already exists", "ROLE_CODE_EXISTS");
  }

  if (await roleNameExists(parsed.data.role_name)) {
    return fail(res, 409, "Role name already exists", "ROLE_NAME_EXISTS");
  }

  try {
    const role = await createRole(parsed.data);
    return created(res, role, "Role created successfully");
  } catch (error) {
    return fail(res, 400, error.message || "Failed to create role", "CREATE_ROLE_FAILED");
  }
}

export async function patch(req, res) {
  const roleId = Number(req.params.roleId);

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const current = await getRoleById(roleId);
  if (!current) return fail(res, 404, "Role not found", "ROLE_NOT_FOUND");

  if (parsed.data.role_name && await roleNameExists(parsed.data.role_name, roleId)) {
    return fail(res, 409, "Role name already exists", "ROLE_NAME_EXISTS");
  }

  try {
    const role = await updateRole(roleId, parsed.data);
    return ok(res, role, "Role updated successfully");
  } catch (error) {
    return fail(res, 400, error.message || "Failed to update role", "UPDATE_ROLE_FAILED");
  }
}

export async function remove(req, res) {
  const roleId = Number(req.params.roleId);
  const role = await getRoleById(roleId);
  if (!role) return fail(res, 404, "Role not found", "ROLE_NOT_FOUND");

  if (role.is_system === 1) {
    return fail(res, 400, "System role cannot be deleted", "SYSTEM_ROLE_LOCKED");
  }

  const usedCount = await countUsersByRoleId(roleId);
  if (usedCount > 0) {
    return fail(res, 400, "Role is assigned to users", "ROLE_IN_USE");
  }

  const deleted = await deactivateRole(roleId);
  if (!deleted) return fail(res, 400, "Failed to delete role", "DELETE_ROLE_FAILED");

  return ok(res, {}, "Role deleted successfully");
}
