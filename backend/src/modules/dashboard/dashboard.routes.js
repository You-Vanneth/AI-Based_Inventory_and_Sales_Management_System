import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { analytics, summary } from "./dashboard.controller.js";

const router = Router();

router.get("/summary", requireAuth, asyncHandler(summary));
router.get("/analytics", requireAuth, asyncHandler(analytics));

export default router;
