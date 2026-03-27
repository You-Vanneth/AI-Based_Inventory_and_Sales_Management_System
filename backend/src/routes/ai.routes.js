import { Router } from "express";

export function createAiRouter({ authRequired, aiController }) {
  const router = Router();

  router.get("/ai/model-performance", authRequired, aiController.modelPerformance);
  router.get("/ai/forecast/versions", authRequired, aiController.forecastVersions);
  router.get("/ai/forecast/history", authRequired, aiController.forecastHistory);
  router.get("/ai/scheduler/status", authRequired, aiController.schedulerStatus);
  router.post("/ai/forecast/run", authRequired, aiController.runForecast);
  router.post("/ai/forecast/bulk-run", authRequired, aiController.bulkRun);

  return router;
}
