import app from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./db/pool.js";
import { startAlertScheduler } from "./modules/alerts/alerts.scheduler.js";

async function bootstrap() {
  await checkDatabaseConnection();
  startAlertScheduler({
    enabled: env.alerts.jobEnabled,
    intervalMinutes: env.alerts.intervalMinutes
  });
  app.listen(env.port, () => {
    console.log(`${env.appName} running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
