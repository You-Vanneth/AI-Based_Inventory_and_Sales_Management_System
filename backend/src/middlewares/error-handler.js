import { fail } from "../utils/http.js";

export function notFoundHandler(req, res) {
  return fail(res, 404, "Route not found", "NOT_FOUND");
}

export function errorHandler(err, req, res, next) {
  if (err?.name === "ZodError") {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }));
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", errors);
  }

  const status = err.statusCode || 500;
  const message = status === 500 ? "Internal server error" : err.message;
  return fail(res, status, message, err.errorCode || "INTERNAL_ERROR");
}
