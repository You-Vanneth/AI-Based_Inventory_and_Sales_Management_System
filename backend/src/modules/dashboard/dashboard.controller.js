import { ok } from "../../utils/http.js";
import { getDashboardAnalytics, getDashboardSummary } from "./dashboard.service.js";

export async function summary(req, res) {
  const data = await getDashboardSummary();
  return ok(res, data, "Dashboard summary fetched");
}

export async function analytics(req, res) {
  const data = await getDashboardAnalytics();
  return ok(res, data, "Dashboard analytics fetched");
}
