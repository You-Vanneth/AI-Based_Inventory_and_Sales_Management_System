import jwt from "jsonwebtoken";
import { fail, ok, created } from "../../utils/http.js";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema
} from "./auth.validator.js";
import {
  changePassword,
  createUser,
  findActiveUserByEmail,
  findUserById,
  issueAccessToken,
  verifyPassword
} from "./auth.service.js";

export function getTokenExpiresInSeconds(accessToken) {
  const decoded = jwt.decode(accessToken);
  return decoded &&
    typeof decoded === "object" &&
    typeof decoded.exp === "number" &&
    typeof decoded.iat === "number"
    ? decoded.exp - decoded.iat
    : null;
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const exists = await findActiveUserByEmail(parsed.data.email);
  if (exists) {
    return fail(res, 409, "Email already in use", "EMAIL_EXISTS");
  }

  const user = await createUser(parsed.data);
  return created(res, user, "User registered successfully");
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const user = await findActiveUserByEmail(parsed.data.email);
  if (!user) return fail(res, 401, "Invalid credentials", "INVALID_CREDENTIALS");

  const isPasswordValid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!isPasswordValid) return fail(res, 401, "Invalid credentials", "INVALID_CREDENTIALS");

  const accessToken = issueAccessToken(user);
  const expiresInSeconds = getTokenExpiresInSeconds(accessToken);

  return ok(res, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresInSeconds,
    user: {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role_code || user.role,
      role_id: user.role_id || null,
      role_name: user.role_name || user.role,
      permissions: user.permissions || []
    }
  }, "Login successful");
}

export async function me(req, res) {
  const user = await findUserById(req.user.user_id);
  if (!user) return fail(res, 404, "User not found", "USER_NOT_FOUND");
  return ok(res, user, "Profile fetched");
}

export async function updatePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message
    })));
  }

  const currentUser = await findActiveUserByEmail(req.user.email);
  if (!currentUser) return fail(res, 404, "User not found", "USER_NOT_FOUND");

  const validCurrent = await verifyPassword(parsed.data.current_password, currentUser.password_hash);
  if (!validCurrent) {
    return fail(res, 400, "Current password is incorrect", "INVALID_CURRENT_PASSWORD");
  }

  await changePassword(currentUser.user_id, parsed.data.new_password);
  return ok(res, {}, "Password changed successfully");
}

export async function logout(req, res) {
  return ok(res, {}, "Logout successful");
}
