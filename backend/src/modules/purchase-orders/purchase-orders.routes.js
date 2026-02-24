import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  approve,
  cancel,
  create,
  getById,
  list,
  patch,
  receive
} from "./purchase-orders.controller.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:purchaseOrderId", asyncHandler(getById));
router.patch("/:purchaseOrderId", asyncHandler(patch));
router.post("/:purchaseOrderId/approve", asyncHandler(approve));
router.post("/:purchaseOrderId/receive", asyncHandler(receive));
router.post("/:purchaseOrderId/cancel", asyncHandler(cancel));

export default router;
