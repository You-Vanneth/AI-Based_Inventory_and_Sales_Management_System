import { fail, ok } from "../../utils/http.js";
import { getForecastByProduct, getReorderRecommendations } from "./ai.service.js";

export async function forecastByProduct(req, res) {
  const productId = Number(req.params.productId);
  const days = req.query.days;
  const leadTime = req.query.lead_time;

  const result = await getForecastByProduct(productId, days, leadTime);
  if (!result) return fail(res, 404, "Product not found", "PRODUCT_NOT_FOUND");

  return ok(res, result, "AI forecast generated");
}

export async function reorderRecommendations(req, res) {
  const days = req.query.days;
  const leadTime = req.query.lead_time;

  const result = await getReorderRecommendations(days, leadTime);
  return ok(res, result, "AI reorder recommendations generated");
}
