import { runPythonJson } from "../utils/python.js";
import { clamp, nowIso, toNumber } from "../utils/helpers.js";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildSyntheticHistory(product, horizon = 90) {
  const monthlySales = Math.max(0, toNumber(product?.monthly_sales, 0));
  const baseDaily = monthlySales > 0 ? monthlySales / 30 : Math.max(0.4, toNumber(product?.min_stock_level, 0) / 20);
  const weeklyPattern = [0.88, 0.92, 1.0, 1.04, 1.08, 1.18, 1.12];
  const rows = [];
  const today = new Date();
  for (let i = horizon - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const weekdayFactor = weeklyPattern[date.getDay()];
    const trendFactor = 0.94 + ((horizon - i) / horizon) * 0.12;
    const value = Number((baseDaily * weekdayFactor * trendFactor).toFixed(2));
    rows.push({ ds: date.toISOString().slice(0, 10), y: Math.max(0, value) });
  }
  return rows;
}

export function createAiService({
  dbQuery,
  isMysqlEnabled,
  products,
  sales,
  categories,
  aiForecastVersions,
  aiForecastHistory,
  nextForecastVersionId,
  notificationService
}) {
  async function fetchProductById(productId) {
    if (isMysqlEnabled()) {
      const rows = await dbQuery(
        `SELECT p.*, c.name_en AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [productId]
      );
      return rows[0] || null;
    }
    const product = products.find((item) => Number(item.id) === Number(productId)) || null;
    if (!product) return null;
    const category = categories.find((item) => Number(item.id) === Number(product.category_id));
    return {
      ...product,
      category_name: category?.name_en || product.category_name || "-"
    };
  }

  async function fetchActiveProducts() {
    if (isMysqlEnabled()) {
      return dbQuery(
        `SELECT p.*, c.name_en AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'ACTIVE'
         ORDER BY p.product_name ASC`
      );
    }
    return products
      .filter((item) => String(item.status || "ACTIVE") === "ACTIVE")
      .map((item) => {
        const category = categories.find((row) => Number(row.id) === Number(item.category_id));
        return {
          ...item,
          category_name: category?.name_en || item.category_name || "-"
        };
      });
  }

  async function fetchHistory(product) {
    if (isMysqlEnabled()) {
      const rows = await dbQuery(
        `SELECT DATE(s.sale_time) AS ds, SUM(si.qty) AS y
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = ?
           AND s.is_refund = 0
         GROUP BY DATE(s.sale_time)
         ORDER BY ds ASC`,
        [product.id]
      );
      const normalized = rows
        .map((row) => ({
          ds: formatDate(row.ds),
          y: toNumber(row.y, 0)
        }))
        .filter((row) => row.ds);
      return normalized.length >= 7 ? normalized : buildSyntheticHistory(product);
    }

    const grouped = new Map();
    sales
      .filter((sale) => !sale.is_refund)
      .forEach((sale) => {
        const ds = formatDate(sale.sale_time);
        if (!ds) return;
        (sale.items || [])
          .filter((item) => Number(item.product_id) === Number(product.id))
          .forEach((item) => {
            grouped.set(ds, (grouped.get(ds) || 0) + toNumber(item.qty, 0));
          });
      });
    const rows = [...grouped.entries()]
      .map(([ds, y]) => ({ ds, y: Number(y.toFixed(2)) }))
      .sort((a, b) => a.ds.localeCompare(b.ds));
    return rows.length >= 7 ? rows : buildSyntheticHistory(product);
  }

  async function runProphet({ product, horizonDays, leadDays }) {
    const history = await fetchHistory(product);
    const prophetResult = await runPythonJson("prophet_forecast.py", {
      history,
      horizon_days: horizonDays
    });

    const forecastTotal = toNumber(prophetResult.forecast_total, 0);
    const safetyStock = Number((forecastTotal * 0.2).toFixed(2));
    const requiredStock = Number((forecastTotal + safetyStock).toFixed(2));
    const currentStock = toNumber(product.quantity, 0);
    const suggestedQty = Math.max(0, Math.ceil(requiredStock - currentStock));
    const reorderDate = new Date();
    reorderDate.setDate(reorderDate.getDate() + Math.max(1, leadDays));
    const urgency =
      suggestedQty <= 0 ? "LOW" : currentStock <= 0 ? "CRITICAL" : currentStock <= toNumber(product.min_stock_level, 0) ? "HIGH" : "MEDIUM";

    return {
      product_id: Number(product.id),
      product_name: product.product_name,
      category_name: product.category_name || "-",
      model: "PROPHET",
      history_points: toNumber(prophetResult.history_points, history.length),
      history_tail: Array.isArray(prophetResult.history_tail) ? prophetResult.history_tail : history.slice(-14),
      forecast_points: Array.isArray(prophetResult.forecast_points) ? prophetResult.forecast_points : [],
      mae: toNumber(prophetResult.mae, 0),
      mape: toNumber(prophetResult.mape, 0),
      rmse: toNumber(prophetResult.rmse, 0),
      avg_daily_demand: toNumber(prophetResult.avg_daily_demand, 0),
      forecast_total: forecastTotal,
      ci_low: toNumber(prophetResult.ci_low_total, 0),
      ci_high: toNumber(prophetResult.ci_high_total, 0),
      safety_stock: safetyStock,
      required_stock: requiredStock,
      reorder_level: requiredStock,
      current_stock: currentStock,
      suggest_qty: suggestedQty,
      lead_days: leadDays,
      reorder_date: reorderDate.toISOString().slice(0, 10),
      urgency
    };
  }

  async function persistRun(result, horizonDays) {
    if (isMysqlEnabled()) {
      const insert = await dbQuery(
        `INSERT INTO ai_forecast_runs
         (product_id, horizon_days, selected_model, mae, mape, rmse, avg_daily_demand, forecast_total, reorder_level, ci_low, ci_high)
         VALUES (?, ?, 'PROPHET', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.product_id,
          horizonDays,
          result.mae,
          result.mape,
          result.rmse,
          result.avg_daily_demand,
          result.forecast_total,
          result.reorder_level,
          result.ci_low,
          result.ci_high
        ]
      );
      await dbQuery(
        `INSERT INTO ai_forecast_versions
         (version_code, product_id, model_name, horizon_days, mape, generated_at)
         VALUES (?, ?, 'PROPHET', ?, ?, NOW())`,
        [`FCAST-${new Date().toISOString().slice(0, 10)}-${String(insert.insertId).padStart(4, "0")}`, result.product_id, horizonDays, result.mape]
      );
      return insert.insertId;
    }

    const nextId = nextForecastVersionId();
    aiForecastHistory.unshift({
      id: nextId,
      time: nowIso(),
      product: result.product_id,
      product_name: result.product_name,
      horizon: horizonDays,
      selected: "PROPHET",
      mae: result.mae,
      mape: result.mape,
      rmse: result.rmse
    });
    aiForecastVersions.unshift({
      id: nextId,
      version: `FCAST-${new Date().toISOString().slice(0, 10)}-${String(nextId).padStart(4, "0")}`,
      product: result.product_id,
      product_name: result.product_name,
      model: "PROPHET",
      generated_at: nowIso(),
      horizon: horizonDays,
      mape: result.mape
    });
    return nextId;
  }

  async function buildRecommendations(activeProducts, horizonDays, leadDays) {
    const recommendations = [];
    for (const product of activeProducts) {
      const result = await runProphet({ product, horizonDays, leadDays });
      recommendations.push({
        product_id: result.product_id,
        product: result.product_name,
        avg_day: result.avg_daily_demand,
        lead: leadDays,
        reorder: result.reorder_level,
        stock: result.current_stock,
        suggest: result.suggest_qty,
        reorder_date: result.reorder_date,
        urgency: result.urgency,
        selected_model: "PROPHET",
        confidence: `${Math.max(0, Math.round((1 - Math.min(result.mape, 100) / 100) * 100))}%`
      });
    }
    return recommendations.sort((a, b) => b.suggest - a.suggest || a.product.localeCompare(b.product));
  }

  async function getModelPerformance() {
    if (isMysqlEnabled()) {
      const rows = await dbQuery(
        `SELECT afr.product_id, p.product_name AS product, COALESCE(c.name_en, '-') AS category,
                afr.mae, afr.mape, afr.rmse, afr.horizon_days AS horizon,
                TO_CHAR(afr.created_at, 'YYYY-MM-DD HH24:MI') AS generated_at
         FROM ai_forecast_runs afr
         JOIN (
           SELECT product_id, MAX(id) AS max_id
           FROM ai_forecast_runs
           GROUP BY product_id
         ) latest ON latest.max_id = afr.id
         JOIN products p ON p.id = afr.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         ORDER BY c.name_en ASC, p.product_name ASC`
      );
      return rows;
    }

    return aiForecastHistory.slice(0, 20).map((item) => ({
      product_id: item.product,
      product: item.product_name || `#${item.product}`,
      category: "-",
      mae: item.mae,
      mape: item.mape,
      rmse: item.rmse,
      horizon: item.horizon,
      generated_at: item.time
    }));
  }

  async function getVersions() {
    if (isMysqlEnabled()) {
      return dbQuery(
        `SELECT id, version_code AS version, product_id AS product, 'PROPHET' AS model,
                TO_CHAR(generated_at, 'YYYY-MM-DD HH24:MI') AS generated_at,
                horizon_days AS horizon, mape
         FROM ai_forecast_versions
         WHERE model_name = 'PROPHET'
         ORDER BY id DESC`
      );
    }
    return aiForecastVersions.filter((item) => item.model === "PROPHET");
  }

  async function getHistory() {
    if (isMysqlEnabled()) {
      return dbQuery(
        `SELECT afr.id,
                TO_CHAR(afr.created_at, 'YYYY-MM-DD HH24:MI') AS time,
                afr.product_id AS product,
                p.product_name,
                afr.horizon_days AS horizon,
                'PROPHET' AS selected,
                afr.mae,
                afr.mape,
                afr.rmse
         FROM ai_forecast_runs afr
         JOIN products p ON p.id = afr.product_id
         WHERE afr.selected_model = 'PROPHET'
         ORDER BY afr.id DESC`
      );
    }
    return aiForecastHistory.filter((item) => item.selected === "PROPHET");
  }

  async function runSingleForecast({ productId, days = 30, lead = 7, alertAuto = true }) {
    const horizonDays = clamp(toNumber(days, 30), 1, 180);
    const leadDays = clamp(toNumber(lead, 7), 1, 60);
    const product = (await fetchProductById(productId)) || (await fetchActiveProducts())[0];
    if (!product) throw new Error("No active products found");
    const result = await runProphet({ product, horizonDays, leadDays });
    await persistRun(result, horizonDays);

    const recommendations = await buildRecommendations(await fetchActiveProducts(), horizonDays, leadDays);
    if (alertAuto && result.suggest_qty > 0) {
      await notificationService.createNotification({
        type: "REORDER_AI",
        productId: result.product_id,
        productName: result.product_name,
        message: `Prophet forecast recommends reorder quantity ${result.suggest_qty} for the next ${horizonDays} day(s).`,
        sourceLink: "/ai"
      });
    }

    return {
      forecast: {
        model: "PROPHET",
        avg: result.avg_daily_demand,
        total: result.forecast_total,
        reorder: result.reorder_level,
        suggest_qty: result.suggest_qty,
        safety_stock: result.safety_stock,
        ci_low: result.ci_low,
        ci_high: result.ci_high,
        reorder_date: result.reorder_date,
        urgency: result.urgency,
        series: {
          history: result.history_tail,
          forecast: result.forecast_points
        }
      },
      run: {
        time: nowIso(),
        product: result.product_id,
        product_name: result.product_name,
        horizon: horizonDays,
        selected: "PROPHET",
        mae: result.mae,
        mape: result.mape,
        rmse: result.rmse
      },
      reorder_recommendations: recommendations
    };
  }

  async function runBulkForecast({ days = 30, lead = 7, alertAuto = true }) {
    const horizonDays = clamp(toNumber(days, 30), 1, 180);
    const leadDays = clamp(toNumber(lead, 7), 1, 60);
    const activeProducts = await fetchActiveProducts();
    let processed = 0;
    for (const product of activeProducts) {
      const result = await runProphet({ product, horizonDays, leadDays });
      await persistRun(result, horizonDays);
      processed += 1;
      if (alertAuto && result.suggest_qty > 0) {
        await notificationService.createNotification({
          type: "REORDER_AI",
          productId: result.product_id,
          productName: result.product_name,
          message: `Prophet forecast recommends reorder quantity ${result.suggest_qty} for the next ${horizonDays} day(s).`,
          sourceLink: "/ai"
        });
      }
    }
    return {
      status: "COMPLETED",
      progress: 100,
      processed_products: processed
    };
  }

  return {
    getModelPerformance,
    getVersions,
    getHistory,
    runSingleForecast,
    runBulkForecast
  };
}
