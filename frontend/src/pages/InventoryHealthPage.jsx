import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";

const stockLow = [
  { product: "Instant Noodle", category: "Food", qty: 5, min: 12 },
  { product: "Hand Soap", category: "Personal Care", qty: 2, min: 8 }
];

const expiryData = [
  { product: "UHT Milk", barcode: "8850003", qty: 8, expiry: "2026-03-03", days_left: 5 },
  { product: "Yogurt", barcode: "8850010", qty: 4, expiry: "2026-03-01", days_left: 3 }
];

export default function InventoryHealthPage() {
  const [windowDays, setWindowDays] = useState(30);

  const expiryRows = useMemo(
    () => expiryData.filter((x) => x.days_left <= Number(windowDays)),
    [windowDays]
  );

  return (
    <Layout title="Inventory Health">
      <section className="hero">
        <h2>{t("Inventory Health Center")}</h2>
        <p>{t("low stock and expiry priorities.")}</p>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">Low Stock Items</div><div className="kpi-value">{stockLow.length}</div></article>
        <article className="kpi"><div className="kpi-label">Expiring Soon</div><div className="kpi-value">{expiryRows.length}</div></article>
        <article className="kpi"><div className="kpi-label">Critical (&lt;=3 days)</div><div className="kpi-value">{expiryRows.filter((x) => x.days_left <= 3).length}</div></article>
        <article className="kpi"><div className="kpi-label">Out of Stock</div><div className="kpi-value">{stockLow.filter((x) => x.qty <= 0).length}</div></article>
      </section>

      <section className="card">
        <div className="row">
          <div>
            <label>{t("Window (Days)")}</label>
            <select value={windowDays} onChange={(e) => setWindowDays(e.target.value)}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button">{t("Refresh")}</button>
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">Low Stock Action Board</h3>
          <DataTable
            columns={["Product", "Category", "Qty", "Min", "Gap", "Action"]}
            rows={stockLow.map((x) => [
              x.product,
              x.category,
              x.qty,
              x.min,
              Math.max(0, x.min - x.qty),
              `Reorder +${Math.max(0, x.min - x.qty)}`
            ])}
            emptyText={t("No low stock")}
          />
        </article>

        <article className="card">
          <h3 className="card-title">Expiry Prioritization (FEFO)</h3>
          <DataTable
            columns={["Product", "Barcode", "Qty", "Expiry", "Days Left", "Priority"]}
            rows={expiryRows.map((x) => [
              x.product,
              x.barcode,
              x.qty,
              x.expiry,
              x.days_left,
              x.days_left <= 3 ? "Critical" : x.days_left <= 7 ? "High" : "Normal"
            ])}
            emptyText={t("No expiry risk")}
          />
        </article>
      </section>
    </Layout>
  );
}
