import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { forecastByProduct, reorderRecommendations } from "./ai.controller.js";

const router = Router();

router.get("/forecast/products/:productId", requireAuth, requireRole("ADMIN"), asyncHandler(forecastByProduct));
router.get("/reorder-recommendations", requireAuth, requireRole("ADMIN"), asyncHandler(reorderRecommendations));

export default router;
