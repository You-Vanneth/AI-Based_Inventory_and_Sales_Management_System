import { ok } from "../../utils/http.js";
import { getExpiringSoonAlerts, getLowStockAlerts, runAlertCheckAndSend } from "./alerts.service.js";

export async function lowStock(req, res) {
  const data = await getLowStockAlerts();
  return ok(res, data, "Low stock alerts fetched");
}

export async function expiringSoon(req, res) {
  const data = await getExpiringSoonAlerts();
  return ok(res, data, "Expiring soon alerts fetched");
}

export async function runCheck(req, res) {
  const data = await runAlertCheckAndSend();
  return ok(res, data, "Alert check completed");
}
