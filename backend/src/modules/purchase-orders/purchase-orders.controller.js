import { created, fail, ok } from "../../utils/http.js";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrderById,
  listPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder
} from "./purchase-orders.service.js";
import {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema
} from "./purchase-orders.validator.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const status = req.query.status ? String(req.query.status) : undefined;

  const result = await listPurchaseOrders({ page, limit, status });
  return ok(res, result.rows, "Purchase orders fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const po = await getPurchaseOrderById(Number(req.params.purchaseOrderId));
  if (!po) return fail(res, 404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
  return ok(res, po, "Purchase order fetched");
}

export async function create(req, res, next) {
  const parsed = createPurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));
  }

  try {
    const po = await createPurchaseOrder(parsed.data, req.user.user_id);
    return created(res, po, "Purchase order created successfully");
  } catch (error) {
    return next(error);
  }
}

export async function patch(req, res, next) {
  const parsed = updatePurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));
  }

  try {
    const po = await updatePurchaseOrder(Number(req.params.purchaseOrderId), parsed.data, req.user.user_id);
    if (!po) return fail(res, 404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    return ok(res, po, "Purchase order updated");
  } catch (error) {
    return next(error);
  }
}

export async function approve(req, res, next) {
  try {
    const po = await approvePurchaseOrder(Number(req.params.purchaseOrderId), req.user.user_id);
    if (!po) return fail(res, 404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    return ok(res, po, "Purchase order approved");
  } catch (error) {
    return next(error);
  }
}

export async function receive(req, res, next) {
  const parsed = receivePurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));
  }

  try {
    const po = await receivePurchaseOrder(Number(req.params.purchaseOrderId), parsed.data, req.user.user_id);
    return ok(res, po, "Purchase order received");
  } catch (error) {
    return next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const po = await cancelPurchaseOrder(Number(req.params.purchaseOrderId), req.user.user_id);
    if (!po) return fail(res, 404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    return ok(res, po, "Purchase order cancelled");
  } catch (error) {
    return next(error);
  }
}
