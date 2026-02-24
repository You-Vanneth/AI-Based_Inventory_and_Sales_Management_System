export function ok(res, data = {}, message = "Request successful", meta = undefined) {
  const response = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(200).json(response);
}

export function created(res, data = {}, message = "Created successfully") {
  return res.status(201).json({ success: true, message, data });
}

export function fail(res, status, message, errorCode = "ERROR", errors = []) {
  return res.status(status).json({
    success: false,
    message,
    error_code: errorCode,
    errors
  });
}
