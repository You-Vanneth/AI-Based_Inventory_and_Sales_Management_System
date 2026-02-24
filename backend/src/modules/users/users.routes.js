import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { create, getById, list, patch, patchStatus, remove, resetPassword } from "./users.controller.js";

const router = Router();

router.use(requireAuth, requirePermission("users.manage"));

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:userId", asyncHandler(getById));
router.patch("/:userId", asyncHandler(patch));
router.patch("/:userId/status", asyncHandler(patchStatus));
router.patch("/:userId/password", asyncHandler(resetPassword));
router.delete("/:userId", asyncHandler(remove));

export default router;
