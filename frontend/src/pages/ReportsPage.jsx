import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";

const sample = {
  "sales-daily": [
    { date: "2026-02-24", txns: 12, units: 34, amount: 28.45 },
    { date: "2026-02-25", txns: 9, units: 20, amount: 19.1 }
  ],
  "sales-monthly": [
    { month: "2026-01", txns: 340, units: 940, amount: 890.4 },
    { month: "2026-02", txns: 291, units: 812, amount: 812.15 }
  ],
  "sales-quarterly": [
    { quarter: "2026-Q1", txns: 631, units: 1752, amount: 1702.55 }
  ],
  "sales-annual": [
    { year: 2026, txns: 631, units: 1752, amount: 1702.55 }
  ],
  "stock-low": [
    { product: "Instant Noodle", barcode: "8850002", qty: 5, min: 12, category: "Food" }
  ],
  "stock-expiry": [
    { product: "UHT Milk", barcode: "8850003", qty: 8, expiry: "2026-03-03", days_left: 5 }
  ],
  "ai-reorder": [
    { product: "Instant Noodle", avg_day: 3.2, lead: 7, reorder_level: 26, stock: 5, suggest_qty: 21 }
  ]
};

export default function ReportsPage() {
  const [type, setType] = useState("sales-daily");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [msg, setMsg] = useState("");

  const rows = sample[type] || [];

  const { columns, tableRows } = useMemo(() => {
    if (!rows.length) return { columns: [t("Result")], tableRows: [] };
    const keys = Object.keys(rows[0]);
    return {
      columns: keys,
      tableRows: rows.map((r) => keys.map((k) => String(r[k] ?? "-")))
    };
  }, [rows]);

  const run = () => {
    setMsg(`Report generated: ${type}${fromDate || toDate ? ` (${fromDate || "-"} to ${toDate || "-"})` : ""}`);
  };

  return (
    <Layout title="Reports">
      <section className="hero">
        <h2>{t("Reports Center")}</h2>
        <p>{t("Quick report fetcher.")}</p>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">Daily Sales</div><div className="kpi-value">$28.45</div></article>
        <article className="kpi"><div className="kpi-label">Monthly Sales</div><div className="kpi-value">$812.15</div></article>
        <article className="kpi"><div className="kpi-label">Low Stock</div><div className="kpi-value">1</div></article>
        <article className="kpi"><div className="kpi-label">Expiry Risk</div><div className="kpi-value">1</div></article>
      </section>

      <section className="card">
        <div className="row">
          <div>
            <label>{t("Report Type")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="sales-daily">{t("Sales Daily")}</option>
              <option value="sales-monthly">{t("Sales Monthly")}</option>
              <option value="sales-quarterly">Sales Quarterly</option>
              <option value="sales-annual">Sales Annual</option>
              <option value="stock-low">{t("Stock Low")}</option>
              <option value="stock-expiry">{t("Stock Expiry")}</option>
              <option value="ai-reorder">{t("AI Reorder")}</option>
            </select>
          </div>
          <div>
            <label>Date From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label>Date To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={run}>{t("Run Report")}</button>
          </div>
        </div>
        {msg ? <div className="msg ok">{msg}</div> : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Report Result</h3>
          <button type="button" className="btn-inline secondary" onClick={() => window.print()}>Print / Export</button>
        </div>
        <DataTable columns={columns} rows={tableRows} emptyText={t("No data")} />
      </section>
    </Layout>
  );
}
