import crypto from "node:crypto";

export function attachRequestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: "Route not found",
    request_id: req.requestId || null
  });
}

export function errorHandler(err, req, res, _next) {
  const status = Number(err?.status || err?.statusCode || 500);
  const isOperational = status >= 400 && status < 500;
  const message = isOperational
    ? String(err.message || "Request failed")
    : "Internal server error";

  // eslint-disable-next-line no-console
  console.error(`[${req.requestId || "no-request-id"}]`, err);

  if (res.headersSent) return;
  res.status(status).json({
    code: status,
    message,
    request_id: req.requestId || null
  });
}
