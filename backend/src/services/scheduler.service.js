import { nowIso } from "../utils/helpers.js";

const SCHEDULE_INTERVALS = {
  DAILY: 24,
  WEEKLY: 24 * 7
};

export function createSchedulerService({ aiService }) {
  const scheduleCode = String(process.env.AI_FORECAST_SCHEDULE || "WEEKLY").trim().toUpperCase();
  const enabled = scheduleCode in SCHEDULE_INTERVALS;
  const intervalHours = enabled ? SCHEDULE_INTERVALS[scheduleCode] : 0;

  let timer = null;
  let inProgress = false;
  let lastRunAt = null;
  let nextRunAt = enabled ? new Date(Date.now() + intervalHours * 3600 * 1000).toISOString() : null;
  let lastResult = null;

  async function syncFromHistory() {
    if (!enabled || lastRunAt) return;
    try {
      const history = await aiService.getHistory();
      const latest = Array.isArray(history) ? history[0] : null;
      if (!latest?.time) return;
      lastRunAt = latest.time;
      const lastDate = new Date(String(latest.time).replace(" ", "T"));
      if (!Number.isNaN(lastDate.getTime())) {
        nextRunAt = new Date(lastDate.getTime() + intervalHours * 3600 * 1000).toISOString();
      }
    } catch (err) {
      console.error("AI scheduler history sync failed:", err.message);
    }
  }

  async function executeScheduledRun() {
    if (!enabled || inProgress) return;
    inProgress = true;
    try {
      const result = await aiService.runBulkForecast({
        days: 30,
        lead: 7,
        alertAuto: true
      });
      lastRunAt = nowIso();
      nextRunAt = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
      lastResult = result;
    } catch (err) {
      lastRunAt = nowIso();
      nextRunAt = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
      lastResult = { status: "FAILED", message: err.message };
      console.error("AI scheduler failed:", err.message);
    } finally {
      inProgress = false;
    }
  }

  function start() {
    if (!enabled || timer) return;
    syncFromHistory().catch((err) => {
      console.error("AI scheduler startup sync failed:", err.message);
    });
    timer = setInterval(() => {
      executeScheduledRun().catch((err) => {
        console.error("AI scheduler execution error:", err.message);
      });
    }, intervalHours * 3600 * 1000);
  }

  function getStatus() {
    return {
      enabled,
      schedule: enabled ? scheduleCode : "NONE",
      interval_hours: intervalHours,
      in_progress: inProgress,
      last_run_at: lastRunAt,
      next_run_at: nextRunAt,
      last_result: lastResult
    };
  }

  return {
    start,
    getStatus,
    executeScheduledRun
  };
}
