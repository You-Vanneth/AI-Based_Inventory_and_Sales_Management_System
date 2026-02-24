import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import alertsRoutes from "../modules/alerts/alerts.routes.js";
import categoriesRoutes from "../modules/categories/categories.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import emailSettingsRoutes from "../modules/email-settings/email-settings.routes.js";
import inventoryRoutes from "../modules/inventory/inventory.routes.js";
import paymentsRoutes from "../modules/payments/payments.routes.js";
import purchaseOrdersRoutes from "../modules/purchase-orders/purchase-orders.routes.js";
import productsRoutes from "../modules/products/products.routes.js";
import reportsRoutes from "../modules/reports/reports.routes.js";
import rolesRoutes from "../modules/roles/roles.routes.js";
import salesRoutes from "../modules/sales/sales.routes.js";
import systemLogsRoutes from "../modules/system-logs/system-logs.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import aiRoutes from "../modules/ai/ai.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/roles", rolesRoutes);
router.use("/categories", categoriesRoutes);
router.use("/products", productsRoutes);
router.use("/sales", salesRoutes);
router.use("/payments", paymentsRoutes);
router.use("/purchase-orders", purchaseOrdersRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/email-settings", emailSettingsRoutes);
router.use("/alerts", alertsRoutes);
router.use("/inventory-movements", inventoryRoutes);
router.use("/reports", reportsRoutes);
router.use("/ai", aiRoutes);
router.use("/system-logs", systemLogsRoutes);

export default router;
