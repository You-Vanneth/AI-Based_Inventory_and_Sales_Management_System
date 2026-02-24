import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import {
  login,
  logout,
  me,
  register,
  updatePassword
} from "./auth.controller.js";

const router = Router();

router.post("/register", requireAuth, requireRole("ADMIN"), asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/change-password", requireAuth, asyncHandler(updatePassword));

export default router;
