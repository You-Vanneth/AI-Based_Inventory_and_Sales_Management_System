import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { fail } from "../utils/http.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return fail(res, 401, "Unauthorized", "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    return fail(res, 401, "Invalid token", "INVALID_TOKEN");
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }
    return next();
  };
}

export function requirePermission(...permissionKeys) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 401, "Unauthorized", "UNAUTHORIZED");
    }

    if (req.user.role === "ADMIN") {
      return next();
    }

    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const allowed = permissionKeys.some((key) => userPermissions.includes(key));

    if (!allowed) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }

    return next();
  };
}
