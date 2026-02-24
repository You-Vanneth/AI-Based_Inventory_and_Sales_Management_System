import { fail, ok } from "../../utils/http.js";
import { getMovementById, listMovements } from "./inventory.service.js";

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const productId = req.query.product_id ? Number(req.query.product_id) : undefined;
  const movementType = req.query.movement_type ? String(req.query.movement_type) : undefined;
  const dateFrom = req.query.date_from ? String(req.query.date_from) : undefined;
  const dateTo = req.query.date_to ? String(req.query.date_to) : undefined;

  const result = await listMovements({ page, limit, productId, movementType, dateFrom, dateTo });
  return ok(res, result.rows, "Inventory movements fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const data = await getMovementById(Number(req.params.movementId));
  if (!data) return fail(res, 404, "Movement not found", "MOVEMENT_NOT_FOUND");
  return ok(res, data, "Inventory movement fetched");
}
