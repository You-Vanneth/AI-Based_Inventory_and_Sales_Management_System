import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { create, getById, list, patch, remove } from "./categories.controller.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(list));
router.get("/:categoryId", requireAuth, asyncHandler(getById));

router.post("/", requireAuth, requireRole("ADMIN"), asyncHandler(create));
router.patch("/:categoryId", requireAuth, requireRole("ADMIN"), asyncHandler(patch));
router.delete("/:categoryId", requireAuth, requireRole("ADMIN"), asyncHandler(remove));

export default router;
