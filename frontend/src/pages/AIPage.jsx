import React from "react";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const emptyForecast = {
  model: "PROPHET",
  avg: 0,
  total: 0,
  reorder: 0,
  suggest_qty: 0,
  safety_stock: 0,
  ci_low: 0,
  ci_high: 0,
  reorder_date: "-",
  urgency: "LOW",
  series: {
    history: [],
    forecast: []
  }
};

export default function AIPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState(30);
  const [lead, setLead] = useState(7);
  const [history, setHistory] = useState([]);
  const [versions, setVersions] = useState([]);
  const [modelData, setModelData] = useState([]);
  const [reorderData, setReorderData] = useState([]);
  const [forecast, setForecast] = useState(emptyForecast);
  const [scheduler, setScheduler] = useState(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [alertAuto, setAlertAuto] = useState(true);
  const [msg, setMsg] = useState("");
  const [hasForecastRun, setHasForecastRun] = useState(false);

  const loadAiData = async () => {
    const [productsRes, performanceRes, versionsRes, historyRes, schedulerRes] = await Promise.all([
      apiFetch("/products"),
      apiFetch("/ai/model-performance"),
      apiFetch("/ai/forecast/versions"),
      apiFetch("/ai/forecast/history"),
      apiFetch("/ai/scheduler/status")
    ]);

    const nextProducts = Array.isArray(productsRes?.data) ? productsRes.data : [];
    setProducts(nextProducts);
    setModelData(Array.isArray(performanceRes?.data) ? performanceRes.data : []);
    setVersions(Array.isArray(versionsRes?.data) ? versionsRes.data : []);
    setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
    setScheduler(schedulerRes?.data || null);
    if (!productId && nextProducts[0]?.id) {
      setProductId(String(nextProducts[0].id));
    }
  };

  useEffect(() => {
    loadAiData().catch(() => {});
  }, []);

  const metricSummary = useMemo(() => {
    if (!modelData.length) {
      return {
        mae: 0,
        mape: 0,
        rmse: 0
      };
    }
    const divisor = modelData.length || 1;
    const mae = modelData.reduce((sum, item) => sum + Number(item.mae || 0), 0) / divisor;
    const mape = modelData.reduce((sum, item) => sum + Number(item.mape || 0), 0) / divisor;
    const rmse = modelData.reduce((sum, item) => sum + Number(item.rmse || 0), 0) / divisor;
    return {
      mae: Number(mae.toFixed(2)),
      mape: Number(mape.toFixed(2)),
      rmse: Number(rmse.toFixed(2))
    };
  }, [modelData]);

  const confidencePercent = useMemo(() => {
    if (!forecast.total) return 0;
    const spread = Math.abs(Number(forecast.ci_high || 0) - Number(forecast.ci_low || 0));
    const pct = Math.max(0, 100 - (spread / Number(forecast.total || 1)) * 100);
    return Number(pct.toFixed(1));
  }, [forecast]);

  const chartRows = useMemo(() => {
    const historyTail = Array.isArray(forecast.series?.history) ? forecast.series.history.slice(-6) : [];
    const future = Array.isArray(forecast.series?.forecast) ? forecast.series.forecast.slice(0, 6) : [];
    return [
      ...historyTail.map((item) => ({
        label: item.ds,
        actual: Number(item.y || 0),
        predicted: Number(item.y || 0),
        mode: "history"
      })),
      ...future.map((item) => ({
        label: item.ds,
        actual: "-",
        predicted: Number(item.yhat || 0),
        mode: "forecast"
      }))
    ];
  }, [forecast]);

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(productId)) || null,
    [products, productId]
  );

  const runForecast = async () => {
    try {
      const res = await apiFetch("/ai/forecast/run", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(productId || 0),
          days: Number(days),
          lead: Number(lead),
          alert_auto: alertAuto
        })
      });
      setForecast(res?.data?.forecast || emptyForecast);
      setReorderData(Array.isArray(res?.data?.reorder_recommendations) ? res.data.reorder_recommendations : []);
      setHasForecastRun(true);
      await loadAiData();
      setMsg(alertAuto ? t("Forecast completed and restock alert candidates generated.") : t("Forecast completed."));
    } catch (err) {
      setMsg(`${t("Run failed")}: ${err.message}`);
    }
  };

  const runBulkForecast = async () => {
    if (bulkRunning) return;
    try {
      setBulkRunning(true);
      setBulkProgress(20);
      const res = await apiFetch("/ai/forecast/bulk-run", {
        method: "POST",
        body: JSON.stringify({
          days: Number(days),
          lead: Number(lead),
          alert_auto: alertAuto
        })
      });
      setBulkProgress(Number(res?.data?.progress ?? 100));
      setHasForecastRun(true);
      await loadAiData();
      setMsg(t("Bulk forecast completed for all active products."));
    } catch (err) {
      setMsg(`${t("Bulk run failed")}: ${err.message}`);
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <Layout title="AI Forecast">
      <section className="hero">
        <h2>{t("AI Forecast Console")}</h2>
        <p>{t("Prophet-based demand forecasting, replenishment planning, and stock intelligence.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Forecast Controls")}</h3>
        <div className="row">
          <div>
            <label>{t("Product")}</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>{t("Horizon (Days)")}</label>
            <input type="number" min="1" max="180" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <label>{t("Lead Time")}</label>
            <input type="number" min="1" max="60" value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          <div>
            <label>{t("Auto-Create Restock Alerts")}</label>
            <select value={alertAuto ? "YES" : "NO"} onChange={(e) => setAlertAuto(e.target.value === "YES")}>
              <option value="YES">{t("YES")}</option>
              <option value="NO">{t("NO")}</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={runForecast} disabled={!productId}>
              {t("Run Forecast")}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Selected Model")}</div><div className="kpi-value">{t("PROPHET")}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Avg/Day")}</div><div className="kpi-value">{Number(hasForecastRun ? forecast.avg || 0 : 0).toFixed(2)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Forecast")}</div><div className="kpi-value">{Number(hasForecastRun ? forecast.total || 0 : 0).toFixed(2)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Suggested Reorder Qty")}</div><div className="kpi-value">{Number(hasForecastRun ? forecast.suggest_qty || 0 : 0)}</div></article>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("MAE")}</div><div className="kpi-value">{hasForecastRun ? metricSummary.mae : 0}</div></article>
        <article className="kpi"><div className="kpi-label">{t("MAPE")}</div><div className="kpi-value">{hasForecastRun ? metricSummary.mape : 0}%</div></article>
        <article className="kpi"><div className="kpi-label">{t("RMSE")}</div><div className="kpi-value">{hasForecastRun ? metricSummary.rmse : 0}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Confidence")}</div><div className="kpi-value">{hasForecastRun ? confidencePercent : 0}%</div></article>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Historical vs Forecast")}</h3>
          <div className="trend-shell">
            {chartRows.length ? chartRows.map((item) => (
              <div key={`${item.mode}-${item.label}`} className="bar-row">
                <div className="bar-head">
                  <span>{item.label}</span>
                  <strong>
                    {item.mode === "history" ? `${t("Actual")}: ${item.actual}` : `${t("Forecast")}: ${item.predicted}`}
                  </strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(10, Math.min(100, Math.round((Number(item.predicted || 0) / Math.max(Number(forecast.avg || 1) * 2, 1)) * 100)))}%` }} />
                </div>
              </div>
            )) : <div className="muted">{t("Run a forecast to see Prophet output.")}</div>}
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Forecast Window")}</h3>
          <div className="grid">
            <div className="stock-product-preview">
              <strong>{t("Selected Product")}</strong>
              <span>{selectedProduct?.product_name || "-"}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Predicted Demand")}</strong>
              <span>{Number(forecast.total || 0).toFixed(2)}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Safety Stock")}</strong>
              <span>{Number(forecast.safety_stock || 0).toFixed(2)}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Reorder Date")}</strong>
              <span>{forecast.reorder_date || "-"}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("CI Lower Bound")}</strong>
              <span>{Number(forecast.ci_low || 0).toFixed(2)}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("CI Upper Bound")}</strong>
              <span>{Number(forecast.ci_high || 0).toFixed(2)}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Prophet Model Performance")}</h3>
        <DataTable
          columns={[t("Product"), t("Category"), t("MAE"), t("MAPE"), t("RMSE"), t("Horizon"), t("Generated At")]}
          rows={modelData.map((row) => [
            row.product,
            row.category,
            row.mae,
            `${row.mape}%`,
            row.rmse,
            `${row.horizon}d`,
            row.generated_at
          ])}
          emptyText={t("No data")}
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Reorder Recommendations")}</h3>
        <DataTable
          columns={[t("Product"), t("Avg/Day"), t("Lead"), t("Reorder"), t("Stock"), t("Suggest Qty"), t("Reorder Date"), t("Urgency"), t("Model")]}
          rows={reorderData.map((row) => [
            row.product,
            row.avg_day,
            row.lead,
            row.reorder,
            row.stock,
            row.suggest,
            row.reorder_date,
            <span key={`${row.product}-urgency`} className={`chip ${row.urgency === "CRITICAL" || row.urgency === "HIGH" ? "danger" : "warning"}`}>{t(row.urgency)}</span>,
            t(row.selected_model || "PROPHET")
          ])}
          emptyText={t("No data")}
        />
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Prophet Explainability")}</h3>
          <div className="grid">
            <div className="stock-product-preview">
              <strong>{t("Trend Signal")}</strong>
              <span>{t("Prophet separates long-term demand trend from day-to-day noise.")}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Seasonality Impact")}</strong>
              <span>{t("Weekly seasonality is used to capture repeating retail purchase cycles.")}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Recommendation Logic")}</strong>
              <span>{t("Reorder quantity = forecast demand + 20% safety stock - current stock.")}</span>
            </div>
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Bulk Forecast Job")}</h3>
          <div className="grid">
            <div>
              <label>{t("Action")}</label>
              <button type="button" onClick={runBulkForecast} disabled={bulkRunning}>
                {bulkRunning ? t("Running...") : t("Run For All Active Products")}
              </button>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Progress")}</strong>
              <span>{bulkProgress}%</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Automated Schedule")}</strong>
              <span>{t(scheduler?.schedule || "NONE")}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Last Run")}</strong>
              <span>{scheduler?.last_run_at || "-"}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Next Run")}</strong>
              <span>{scheduler?.next_run_at || "-"}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Forecast Versions")}</h3>
        <DataTable
          columns={[t("Version"), t("Product"), t("Model"), t("Generated At"), t("Horizon"), t("MAPE")]}
          rows={versions.map((version) => [
            version.version,
            `#${version.product}`,
            t(version.model),
            version.generated_at,
            `${version.horizon}d`,
            `${version.mape}%`
          ])}
          emptyText={t("No versions")}
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Forecast Run History")}</h3>
        <DataTable
          columns={[t("Run Time"), t("Product"), t("Horizon"), t("Model"), t("MAE"), t("MAPE"), t("RMSE")]}
          rows={history.map((item) => [
            item.time,
            item.product_name || `#${item.product}`,
            `${item.horizon}d`,
            t(item.selected),
            item.mae,
            `${item.mape}%`,
            item.rmse
          ])}
          emptyText={t("No run history")}
        />
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
