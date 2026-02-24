import { writeSystemLog } from "../utils/system-log.js";

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
}

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return null;
  const cloned = { ...body };
  const secretKeys = ["password", "current_password", "new_password", "smtp_password", "smtp_password_encrypted"];
  for (const key of secretKeys) {
    if (Object.hasOwn(cloned, key)) cloned[key] = "[REDACTED]";
  }
  return cloned;
}

export function systemLogMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

  const startedAt = Date.now();

  res.on("finish", () => {
    // Log only app API routes
    if (!req.originalUrl.startsWith("/api/v1/")) return;

    const path = req.originalUrl.split("?")[0];
    const routeSegments = path.replace("/api/v1/", "").split("/").filter(Boolean);
    const entityType = routeSegments[0] || "unknown";
    const entityId = routeSegments[1] || null;

    void writeSystemLog({
      actorUserId: req.user?.user_id || null,
      actionType: `${method} ${path}`,
      entityType,
      entityId,
      details: {
        status_code: res.statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: sanitizeBody(req.body)
      },
      ipAddress: getClientIp(req)
    });
  });

  return next();
}
