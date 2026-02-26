import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";

const reorderRows = [
  { product: "Instant Noodle", avg_day: 3.2, lead: 7, reorder: 26, stock: 5, suggest: 21 },
  { product: "UHT Milk", avg_day: 1.4, lead: 5, reorder: 10, stock: 8, suggest: 2 }
];

export default function AIPage() {
  const [productId, setProductId] = useState(1);
  const [days, setDays] = useState(30);
  const [lead, setLead] = useState(7);
  const [ran, setRan] = useState(false);

  const forecast = useMemo(() => {
    const avg = 2.7;
    const total = Number((avg * Number(days || 0)).toFixed(2));
    const reorder = Number((avg * Number(lead || 0) + 5).toFixed(2));
    return { avg, total, reorder };
  }, [days, lead]);

  return (
    <Layout title="AI Forecast">
      <section className="hero">
        <h2>{t("AI Forecast Console")}</h2>
        <p>{t("product-level forecasting.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">Product Forecast</h3>
        <div className="row">
          <div><label>{t("Product ID")}</label><input type="number" min="1" value={productId} onChange={(e) => setProductId(e.target.value)} /></div>
          <div><label>{t("Days")}</label><input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><label>Lead Time</label><input type="number" min="1" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
          <div><label>{t("Action")}</label><button type="button" onClick={() => setRan(true)}>{t("Run")}</button></div>
        </div>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">Product</div><div className="kpi-value">#{productId}</div></article>
        <article className="kpi"><div className="kpi-label">Avg/Day</div><div className="kpi-value">{forecast.avg}</div></article>
        <article className="kpi"><div className="kpi-label">Forecast</div><div className="kpi-value">{forecast.total}</div></article>
        <article className="kpi"><div className="kpi-label">Reorder</div><div className="kpi-value">{forecast.reorder}</div></article>
      </section>

      <section className="card">
        <h3 className="card-title">Reorder Recommendations</h3>
        <DataTable
          columns={["Product", "Avg/Day", "Lead", "Reorder", "Stock", "Suggest Qty"]}
          rows={reorderRows.map((r) => [r.product, r.avg_day, r.lead, r.reorder, r.stock, r.suggest])}
          emptyText={t("No data")}
        />
      </section>

      {ran ? (
        <section className="card">
          <h3 className="card-title">Model Notes</h3>
          <p>This frontend demo shows the structure for Prophet/ARIMA outputs and reorder decisions.</p>
        </section>
      ) : null}
    </Layout>
  );
}
