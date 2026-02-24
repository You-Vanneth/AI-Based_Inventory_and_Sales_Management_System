import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getById, list } from "./system-logs.controller.js";

const router = Router();

router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(list));
router.get("/:logId", requireAuth, requireRole("ADMIN"), asyncHandler(getById));

export default router;
