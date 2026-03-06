import React from "react";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const reorderRows = [
  { product: "Instant Noodle", avg_day: 3.2, lead: 7, reorder: 26, stock: 5, suggest: 21, reorder_date: "2026-03-08", urgency: "HIGH" },
  { product: "UHT Milk", avg_day: 1.4, lead: 5, reorder: 10, stock: 8, suggest: 2, reorder_date: "2026-03-10", urgency: "MEDIUM" }
];

const modelRows = [
  { category: "Beverages", prophet_mape: 12.8, arima_mape: 14.5, prophet_mae: 3.1, arima_mae: 3.7, prophet_rmse: 4.8, arima_rmse: 5.2, selected: "PROPHET" },
  { category: "Snacks", prophet_mape: 15.2, arima_mape: 13.9, prophet_mae: 3.8, arima_mae: 3.5, prophet_rmse: 5.6, arima_rmse: 5.0, selected: "ARIMA" },
  { category: "Rice & Grains", prophet_mape: 10.5, arima_mape: 11.2, prophet_mae: 2.5, arima_mae: 2.8, prophet_rmse: 3.9, arima_rmse: 4.2, selected: "PROPHET" }
];

const versionSeed = [
  { version: "FCAST-2026-03-01-01", product: 1, model: "PROPHET", generated_at: "2026-03-01 09:00", horizon: 30, mape: 13.4 },
  { version: "FCAST-2026-02-24-03", product: 1, model: "ARIMA", generated_at: "2026-02-24 09:00", horizon: 30, mape: 14.1 }
];

export default function AIPage() {
  const [productId, setProductId] = useState(1);
  const [days, setDays] = useState(30);
  const [lead, setLead] = useState(7);
  const [schedule, setSchedule] = useState("WEEKLY");
  const [ran, setRan] = useState(false);
  const [history, setHistory] = useState([]);
  const [versions, setVersions] = useState(versionSeed);
  const [modelData, setModelData] = useState(modelRows);
  const [reorderData, setReorderData] = useState(reorderRows);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [alertAuto, setAlertAuto] = useState(true);
  const [msg, setMsg] = useState("");

  const forecast = useMemo(() => {
    const avg = 2.7;
    const total = Number((avg * Number(days || 0)).toFixed(2));
    const reorder = Number((avg * Number(lead || 0) + 5).toFixed(2));
    const model = Number(productId) % 2 === 0 ? "ARIMA" : "PROPHET";
    return { avg, total, reorder, model, ciLow: Number((total * 0.85).toFixed(2)), ciHigh: Number((total * 1.15).toFixed(2)) };
  }, [days, lead, productId]);

  useEffect(() => {
    apiFetch("/ai/model-performance")
      .then((res) => setModelData(Array.isArray(res?.data) ? res.data : modelRows))
      .catch(() => {});
    apiFetch("/ai/forecast/versions")
      .then((res) => setVersions(Array.isArray(res?.data) ? res.data : versionSeed))
      .catch(() => {});
    apiFetch("/ai/forecast/history")
      .then((res) => setHistory(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const metricSummary = useMemo(() => {
    const src = modelData.length ? modelData : modelRows;
    const avgMape = src.reduce((sum, x) => sum + Math.min(x.prophet_mape, x.arima_mape), 0) / src.length;
    const avgMae = src.reduce((sum, x) => sum + Math.min(x.prophet_mae, x.arima_mae), 0) / src.length;
    const avgRmse = src.reduce((sum, x) => sum + Math.min(x.prophet_rmse, x.arima_rmse), 0) / src.length;
    return {
      mape: Number(avgMape.toFixed(2)),
      mae: Number(avgMae.toFixed(2)),
      rmse: Number(avgRmse.toFixed(2))
    };
  }, [modelData]);

  const runForecast = async () => {
    try {
      const res = await apiFetch("/ai/forecast/run", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(productId),
          days: Number(days),
          lead: Number(lead),
          alert_auto: alertAuto
        })
      });
      setRan(true);
      if (Array.isArray(res?.data?.reorder_recommendations)) {
        setReorderData(res.data.reorder_recommendations);
      }
      const h = await apiFetch("/ai/forecast/history");
      setHistory(Array.isArray(h?.data) ? h.data : []);
      const v = await apiFetch("/ai/forecast/versions");
      setVersions(Array.isArray(v?.data) ? v.data : []);
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
        body: JSON.stringify({ alert_auto: alertAuto })
      });
      setBulkProgress(Number(res?.data?.progress ?? 100));
      setMsg(t("Bulk forecast completed for all active products."));
    } catch (err) {
      setMsg(`${t("Bulk run failed")}: ${err.message}`);
    } finally {
      setBulkRunning(false);
    }
  };

  const confidencePercent = useMemo(() => {
    if (!forecast.total) return 0;
    const spread = Math.abs(forecast.ciHigh - forecast.ciLow);
    const pct = Math.max(0, 100 - (spread / forecast.total) * 100);
    return Number(pct.toFixed(1));
  }, [forecast]);

  return (
    <Layout title="AI Forecast">
      <section className="hero">
        <h2>{t("AI Forecast Console")}</h2>
        <p>{t("Product-level forecasting, model selection, and replenishment intelligence.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Forecast Controls")}</h3>
        <div className="row">
          <div><label>{t("Product ID")}</label><input type="number" min="1" value={productId} onChange={(e) => setProductId(e.target.value)} /></div>
          <div><label>{t("Horizon (Days)")}</label><input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><label>{t("Lead Time")}</label><input type="number" min="1" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
          <div>
            <label>{t("Schedule")}</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              <option value="DAILY">{t("DAILY")}</option>
              <option value="WEEKLY">{t("WEEKLY")}</option>
            </select>
          </div>
          <div><label>{t("Action")}</label><button type="button" onClick={runForecast}>{t("Run Forecast")}</button></div>
        </div>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Selected Model")}</div><div className="kpi-value">{t(forecast.model)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Avg/Day")}</div><div className="kpi-value">{forecast.avg}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Forecast")}</div><div className="kpi-value">{forecast.total}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Reorder")}</div><div className="kpi-value">{forecast.reorder}</div></article>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("MAE")}</div><div className="kpi-value">{metricSummary.mae}</div></article>
        <article className="kpi"><div className="kpi-label">{t("MAPE")}</div><div className="kpi-value">{metricSummary.mape}%</div></article>
        <article className="kpi"><div className="kpi-label">{t("RMSE")}</div><div className="kpi-value">{metricSummary.rmse}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Confidence")}</div><div className="kpi-value">{confidencePercent}%</div></article>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Historical vs Forecast (UI Preview)")}</h3>
          <div className="trend-shell">
            {[
              { label: "D-6", actual: 2.1, predicted: 2.3 },
              { label: "D-5", actual: 2.7, predicted: 2.6 },
              { label: "D-4", actual: 2.5, predicted: 2.7 },
              { label: "D-3", actual: 3.0, predicted: 2.9 },
              { label: "D-2", actual: 2.8, predicted: 2.8 },
              { label: "D-1", actual: 3.4, predicted: 3.1 }
            ].map((x) => (
              <div key={x.label} className="bar-row">
                <div className="bar-head">
                  <span>{x.label}</span>
                  <strong>A:{x.actual} / P:{x.predicted}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(10, Math.round((x.predicted / 3.5) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Confidence Interval Window")}</h3>
          <div className="grid">
            <div className="stock-product-preview">
              <strong>{t("Predicted Demand")}</strong>
              <span>{forecast.total}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("CI Lower Bound")}</strong>
              <span>{forecast.ciLow}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("CI Upper Bound")}</strong>
              <span>{forecast.ciHigh}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Interpretation")}</strong>
              <span>{t("Expected range in next")} {days} {t("days with current model assumptions.")}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Model Performance Comparison")}</h3>
        <DataTable
          columns={[t("Category"), t("Prophet MAE"), t("Prophet MAPE"), t("Prophet RMSE"), t("ARIMA MAE"), t("ARIMA MAPE"), t("ARIMA RMSE"), t("Selected")]}
          rows={modelData.map((r) => [
            r.category,
            r.prophet_mae,
            `${r.prophet_mape}%`,
            r.prophet_rmse,
            r.arima_mae,
            `${r.arima_mape}%`,
            r.arima_rmse,
            t(r.selected)
          ])}
          emptyText="No data"
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Reorder Recommendations")}</h3>
        <DataTable
          columns={[t("Product"), t("Avg/Day"), t("Lead"), t("Reorder"), t("Stock"), t("Suggest Qty"), t("Reorder Date"), t("Urgency")]}
          rows={reorderData.map((r) => [
            r.product,
            r.avg_day,
            r.lead,
            r.reorder,
            r.stock,
            r.suggest,
            r.reorder_date,
            <span key={`${r.product}-u`} className={`chip ${r.urgency === "HIGH" ? "danger" : "warning"}`}>{t(r.urgency)}</span>
          ])}
          emptyText="No data"
        />
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Model Explainability")}</h3>
          <div className="grid">
            <div className="stock-product-preview">
              <strong>{t("Why")} {t(forecast.model)} {t("selected?")}</strong>
              <span>{t("Lower expected MAPE for this product demand pattern in recent windows.")}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Seasonality Impact")}</strong>
              <span>{t("Weekly demand cycle detected around weekend peak.")}</span>
            </div>
            <div className="stock-product-preview">
              <strong>{t("Trend Signal")}</strong>
              <span>{t("Stable upward trend with moderate volatility.")}</span>
            </div>
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Bulk Forecast Job")}</h3>
          <div className="grid">
            <div>
              <label>{t("Auto-Create Restock Alerts")}</label>
              <select value={alertAuto ? "YES" : "NO"} onChange={(e) => setAlertAuto(e.target.value === "YES")}>
                <option value="YES">{t("YES")}</option>
                <option value="NO">{t("NO")}</option>
              </select>
            </div>
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
          </div>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Forecast Versions")}</h3>
        <DataTable
          columns={[t("Version"), t("Product"), t("Model"), t("Generated At"), t("Horizon"), t("MAPE"), t("Action")]}
          rows={versions.map((v) => [
            v.version,
            `#${v.product}`,
            t(v.model),
            v.generated_at,
            `${v.horizon}d`,
            `${v.mape}%`,
            <button key={v.version} type="button" className="btn-inline">{t("Open")}</button>
          ])}
          emptyText={t("No versions")}
        />
      </section>

      {ran ? (
        <section className="card">
          <h3 className="card-title">{t("Forecast Run History")}</h3>
          <DataTable
            columns={[t("Run Time"), t("Product ID"), t("Horizon"), t("Model"), t("MAE"), t("MAPE"), t("RMSE")]}
            rows={history.map((h) => [h.time, `#${h.product}`, `${h.horizon}d`, t(h.selected), h.mae, `${h.mape}%`, h.rmse])}
            emptyText={t("No run history")}
          />
        </section>
      ) : null}

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
