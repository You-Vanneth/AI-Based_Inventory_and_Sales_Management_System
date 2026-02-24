import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getById, list, remove } from "./payments.controller.js";

const router = Router();

router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(list));
router.get("/:paymentId", requireAuth, requireRole("ADMIN"), asyncHandler(getById));
router.delete("/:paymentId", requireAuth, requireRole("ADMIN"), asyncHandler(remove));

export default router;
