import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  create,
  getByBarcode,
  getById,
  list,
  patch,
  remove,
  stockAdjustment
} from "./products.controller.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(list));
router.get("/by-barcode/:barcode", requireAuth, asyncHandler(getByBarcode));
router.get("/:productId", requireAuth, asyncHandler(getById));

router.post("/", requireAuth, requireRole("ADMIN"), asyncHandler(create));
router.patch("/:productId", requireAuth, requireRole("ADMIN"), asyncHandler(patch));
router.delete("/:productId", requireAuth, requireRole("ADMIN"), asyncHandler(remove));
router.patch(
  "/:productId/stock-adjustment",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(stockAdjustment)
);

export default router;
