import { created, fail, ok } from "../../utils/http.js";
import {
  createUserSchema,
  resetPasswordSchema,
  updateStatusSchema,
  updateUserSchema
} from "./users.validator.js";
import {
  createUser,
  existsEmail,
  getUser,
  listUsers,
  resetUserPassword,
  softDeleteUser,
  updateUser,
  updateUserStatus
} from "./users.service.js";

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const q = String(req.query.q || "");

  const result = await listUsers({ page, limit, q });
  return ok(res, result.rows, "Users fetched", {
    page,
    limit,
    total: result.total
  });
}

export async function getById(req, res) {
  const user = await getUser(Number(req.params.userId));
  if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");
  return ok(res, user, "User fetched");
}

export async function create(req, res) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  if (await existsEmail(parsed.data.email)) {
    return fail(res, 409, "Email already in use", "EMAIL_EXISTS");
  }

  try {
    const user = await createUser(parsed.data);
    return created(res, user, "User created successfully");
  } catch (error) {
    return fail(res, 400, error.message || "Failed to create user", "CREATE_USER_FAILED");
  }
}

export async function patch(req, res) {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const targetUserId = Number(req.params.userId);
  if (parsed.data.email && await existsEmail(parsed.data.email, targetUserId)) {
    return fail(res, 409, "Email already in use", "EMAIL_EXISTS");
  }

  try {
    const user = await updateUser(targetUserId, parsed.data);
    if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");

    if (parsed.data.new_password) {
      await resetUserPassword(targetUserId, parsed.data.new_password);
    }

    return ok(res, user, "User updated successfully");
  } catch (error) {
    return fail(res, 400, error.message || "Failed to update user", "UPDATE_USER_FAILED");
  }
}

export async function patchStatus(req, res) {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const user = await updateUserStatus(Number(req.params.userId), parsed.data.is_active);
  if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");
  return ok(res, user, "User status updated");
}

export async function remove(req, res) {
  const userId = Number(req.params.userId);
  if (req.user?.user_id === userId) {
    return fail(res, 400, "You cannot delete your own account", "SELF_DELETE_FORBIDDEN");
  }

  const user = await getUser(userId);
  if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");

  await softDeleteUser(userId);
  return ok(res, {}, "User deleted successfully");
}

export async function resetPassword(req, res) {
  const userId = Number(req.params.userId);
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const user = await getUser(userId);
  if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");

  await resetUserPassword(userId, parsed.data.new_password);
  return ok(res, {}, "User password updated successfully");
}
