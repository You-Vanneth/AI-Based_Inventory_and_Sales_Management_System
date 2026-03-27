export function createAiController({ aiService, schedulerService }) {
  return {
    async modelPerformance(_req, res) {
      try {
        const data = await aiService.getModelPerformance();
        res.json({ data });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    async forecastVersions(_req, res) {
      try {
        const data = await aiService.getVersions();
        res.json({ data });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    async forecastHistory(_req, res) {
      try {
        const data = await aiService.getHistory();
        res.json({ data });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    async schedulerStatus(_req, res) {
      try {
        res.json({ data: schedulerService.getStatus() });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    async runForecast(req, res) {
      try {
        const data = await aiService.runSingleForecast({
          productId: req.body?.product_id,
          days: req.body?.days,
          lead: req.body?.lead,
          alertAuto: req.body?.alert_auto !== false
        });
        res.status(201).json({ data });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
    },

    async bulkRun(req, res) {
      try {
        const data = await aiService.runBulkForecast({
          days: req.body?.days,
          lead: req.body?.lead,
          alertAuto: req.body?.alert_auto !== false
        });
        res.json({ data });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
    }
  };
}
