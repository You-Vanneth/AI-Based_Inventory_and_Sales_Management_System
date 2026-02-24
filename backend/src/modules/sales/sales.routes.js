import { Router } from "express";
import { addToSale } from "../payments/payments.controller.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { create, getById, list, voidById } from "./sales.controller.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(list));
router.post("/", requireAuth, asyncHandler(create));
router.get("/:saleId", requireAuth, asyncHandler(getById));
router.post("/:saleId/payments", requireAuth, asyncHandler(addToSale));
router.post("/:saleId/void", requireAuth, requireRole("ADMIN"), asyncHandler(voidById));

export default router;
