import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { list, listAllPermissions, patch } from "./roles.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("users.manage", "roles.manage"), asyncHandler(list));
router.get("/permissions", requirePermission("users.manage", "roles.manage"), asyncHandler(listAllPermissions));
router.patch("/:roleId", requirePermission("roles.manage"), asyncHandler(patch));

export default router;
