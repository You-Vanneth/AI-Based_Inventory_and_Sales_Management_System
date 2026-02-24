import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { expiringSoon, lowStock, runCheck } from "./alerts.controller.js";

const router = Router();

router.get("/low-stock", requireAuth, requireRole("ADMIN"), asyncHandler(lowStock));
router.get("/expiring-soon", requireAuth, requireRole("ADMIN"), asyncHandler(expiringSoon));
router.post("/run-check", requireAuth, requireRole("ADMIN"), asyncHandler(runCheck));

export default router;
