import { created, fail, ok } from "../../utils/http.js";
import { createSaleSchema } from "./sales.validator.js";
import { createSale, getSaleById, listSales, voidSale } from "./sales.service.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const dateFrom = req.query.date_from ? String(req.query.date_from) : undefined;
  const dateTo = req.query.date_to ? String(req.query.date_to) : undefined;

  const result = await listSales({ page, limit, dateFrom, dateTo });
  return ok(res, result.rows, "Sales fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const sale = await getSaleById(Number(req.params.saleId));
  if (!sale) return fail(res, 404, "Sale not found", "SALE_NOT_FOUND");
  return ok(res, sale, "Sale fetched");
}

export async function create(req, res, next) {
  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  try {
    const sale = await createSale(parsed.data, req.user.user_id);
    return created(res, sale, "Sale created successfully");
  } catch (error) {
    return next(error);
  }
}

export async function voidById(req, res, next) {
  try {
    await voidSale(Number(req.params.saleId), req.user.user_id);
    return ok(res, {}, "Sale voided successfully");
  } catch (error) {
    return next(error);
  }
}
