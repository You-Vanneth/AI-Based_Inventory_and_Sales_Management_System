import { fail, ok } from "../../utils/http.js";
import { getSystemLogById, listSystemLogs } from "./system-logs.service.js";

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const actionType = req.query.action_type ? String(req.query.action_type) : undefined;
  const entityType = req.query.entity_type ? String(req.query.entity_type) : undefined;
  const dateFrom = req.query.date_from ? String(req.query.date_from) : undefined;
  const dateTo = req.query.date_to ? String(req.query.date_to) : undefined;

  const result = await listSystemLogs({ page, limit, actionType, entityType, dateFrom, dateTo });
  return ok(res, result.rows, "System logs fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const data = await getSystemLogById(Number(req.params.logId));
  if (!data) return fail(res, 404, "System log not found", "SYSTEM_LOG_NOT_FOUND");
  return ok(res, data, "System log fetched");
}
