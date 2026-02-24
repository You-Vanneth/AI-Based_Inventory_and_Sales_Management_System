import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getSettings, testEmail, updateSettings } from "./email-settings.controller.js";

const router = Router();

router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(getSettings));
router.put("/", requireAuth, requireRole("ADMIN"), asyncHandler(updateSettings));
router.post("/test", requireAuth, requireRole("ADMIN"), asyncHandler(testEmail));

export default router;
