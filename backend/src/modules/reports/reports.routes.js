import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { aiReorder, salesDaily, salesMonthly, stockExpiry, stockLow } from "./reports.controller.js";

const router = Router();

router.get("/sales/daily", requireAuth, requireRole("ADMIN"), asyncHandler(salesDaily));
router.get("/sales/monthly", requireAuth, requireRole("ADMIN"), asyncHandler(salesMonthly));
router.get("/stock/low", requireAuth, asyncHandler(stockLow));
router.get("/stock/expiry", requireAuth, asyncHandler(stockExpiry));
router.get("/ai/reorder-suggestions", requireAuth, requireRole("ADMIN"), asyncHandler(aiReorder));

export default router;
