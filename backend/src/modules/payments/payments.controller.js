import { created, fail, ok } from "../../utils/http.js";
import { addPaymentSchema } from "./payments.validator.js";
import {
  addPaymentToSale,
  deletePayment,
  getPaymentById,
  listPayments
} from "./payments.service.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const result = await listPayments({ page, limit });
  return ok(res, result.rows, "Payments fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const payment = await getPaymentById(Number(req.params.paymentId));
  if (!payment) return fail(res, 404, "Payment not found", "PAYMENT_NOT_FOUND");
  return ok(res, payment, "Payment fetched");
}

export async function addToSale(req, res, next) {
  const parsed = addPaymentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  try {
    const payment = await addPaymentToSale(Number(req.params.saleId), parsed.data, req.user.user_id);
    return created(res, payment, "Payment added successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deletePayment(Number(req.params.paymentId));
    return ok(res, {}, "Payment deleted successfully");
  } catch (error) {
    return next(error);
  }
}
