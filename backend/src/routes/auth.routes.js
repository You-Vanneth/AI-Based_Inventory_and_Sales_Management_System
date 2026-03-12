import { Router } from "express";

export function createAuthRouter({ authController, authRequired }) {
  const router = Router();

  router.get("/health", authController.health);
  router.post("/auth/login", authController.login);
  router.post("/auth/logout", authRequired, authController.logout);
  router.get("/auth/me", authRequired, authController.me);

  return router;
}
