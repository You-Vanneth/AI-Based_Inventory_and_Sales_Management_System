import { runAlertCheckAndSend } from "./alerts.service.js";

let timerRef = null;

export function startAlertScheduler({ enabled = true, intervalMinutes = 60 } = {}) {
  if (!enabled) {
    console.log("Alert scheduler is disabled");
    return;
  }

  const intervalMs = Math.max(Number(intervalMinutes) || 60, 1) * 60 * 1000;

  const execute = async () => {
    try {
      const result = await runAlertCheckAndSend();
      console.log("Alert scheduler run completed", result);
    } catch (error) {
      console.error("Alert scheduler run failed", error?.message || error);
    }
  };

  // Immediate first run, then interval runs.
  void execute();
  timerRef = setInterval(execute, intervalMs);
  timerRef.unref?.();

  console.log(`Alert scheduler started (every ${Math.round(intervalMs / 60000)} minute(s))`);
}

export function stopAlertScheduler() {
  if (timerRef) clearInterval(timerRef);
  timerRef = null;
}
