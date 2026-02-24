import { ok } from "../../utils/http.js";
import {
  aiReorderSuggestionsReport,
  salesDailyReport,
  salesMonthlyReport,
  stockExpiryReport,
  stockLowReport
} from "./reports.service.js";

export async function salesDaily(req, res) {
  const data = await salesDailyReport(req.query.date_from, req.query.date_to);
  return ok(res, data, "Daily sales report fetched");
}

export async function salesMonthly(req, res) {
  const data = await salesMonthlyReport(req.query.date_from, req.query.date_to);
  return ok(res, data, "Monthly sales report fetched");
}

export async function stockLow(req, res) {
  const data = await stockLowReport();
  return ok(res, data, "Low stock report fetched");
}

export async function stockExpiry(req, res) {
  const data = await stockExpiryReport();
  return ok(res, data, "Expiry report fetched");
}

export async function aiReorder(req, res) {
  const data = await aiReorderSuggestionsReport(req.query.days, req.query.lead_time);
  return ok(res, data, "AI reorder suggestions report fetched");
}
