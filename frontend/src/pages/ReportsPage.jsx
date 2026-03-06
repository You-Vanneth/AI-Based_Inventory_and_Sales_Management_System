import React from "react";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const sample = {
  "sales-daily": [
    { date: "2026-03-01", txns: 42, units: 128, amount: 324.7, cogs: 228.1, gross_profit: 96.6, margin_pct: 29.75, cash: 192.3, card: 81.2, ewallet: 51.2 },
    { date: "2026-03-02", txns: 38, units: 110, amount: 291.5, cogs: 204.8, gross_profit: 86.7, margin_pct: 29.74, cash: 167.9, card: 71.2, ewallet: 52.4 }
  ],
  "sales-monthly": [
    { period: "2026-01", txns: 340, units: 940, amount: 890.4, cogs: 621.4, gross_profit: 269.0, margin_pct: 30.21, growth_pct: 7.5 },
    { period: "2026-02", txns: 291, units: 812, amount: 812.15, cogs: 573.8, gross_profit: 238.35, margin_pct: 29.35, growth_pct: -8.79 }
  ],
  "sales-quarterly": [
    { period: "2026-Q1", txns: 631, units: 1752, amount: 1702.55, cogs: 1195.2, gross_profit: 507.35, margin_pct: 29.8, growth_pct: 6.3 }
  ],
  "sales-annual": [
    { period: "2026", txns: 631, units: 1752, amount: 1702.55, cogs: 1195.2, gross_profit: 507.35, margin_pct: 29.8, growth_pct: 12.4 }
  ],
  "stock-low": [
    { product: "Instant Noodle", barcode: "8850002", qty: 5, min: 12, category: "Food", supplier: "Noodle Trading", value_at_risk: 2.25 }
  ],
  "stock-expiry": [
    { product: "UHT Milk", barcode: "8850003", qty: 8, expiry: "2026-03-12", days_left: 7, category: "Dairy", value_at_risk: 9.6 }
  ],
  "ai-reorder": [
    { product: "Instant Noodle", avg_day: 3.2, lead: 7, reorder_level: 26, stock: 5, suggest_qty: 21, selected_model: "ARIMA", confidence: "80-95%" }
  ],
  "category-contrib": [
    { category: "Drink", revenue: 388.2, contribution_pct: 44.9 },
    { category: "Food", revenue: 312.6, contribution_pct: 36.2 },
    { category: "Dairy", revenue: 102.4, contribution_pct: 11.8 },
    { category: "Household", revenue: 61.1, contribution_pct: 7.1 }
  ],
  "payment-method": [
    { method: "CASH", amount: 460.2, pct: 53.2 },
    { method: "CARD", amount: 220.6, pct: 25.5 },
    { method: "E_WALLET", amount: 184.8, pct: 21.3 }
  ]
};

export default function ReportsPage() {
  const [type, setType] = useState("sales-daily");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [comparePrev, setComparePrev] = useState(true);
  const [exportFormat, setExportFormat] = useState("PDF");
  const [schedule, setSchedule] = useState("NONE");
  const [toEmail, setToEmail] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [generatedBy] = useState(t("Demo Admin"));
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState(sample[type] || []);
  useEffect(() => {
    apiFetch("/reports/history")
      .then((res) => setHistory(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const { columns, tableRows } = useMemo(() => {
    if (!rows.length) return { columns: [t("Result")], tableRows: [] };
    const keys = Object.keys(rows[0]);
    return {
      columns: [...keys, t("Action")],
      tableRows: rows.map((r) => [
        ...keys.map((k) => String(r[k] ?? "-")),
        <button key={`${type}-${String(r[keys[0]])}`} type="button" className="btn-inline">
          {t("Drill Down")}
        </button>
      ])
    };
  }, [rows, type]);

  const summary = useMemo(() => {
    const salesRows = rows.length ? rows : sample["sales-daily"];
    const revenue = salesRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const cogs = salesRows.reduce((sum, r) => sum + Number(r.cogs || 0), 0);
    const gross = revenue - cogs;
    const margin = revenue ? (gross / revenue) * 100 : 0;
    return {
      revenue: Number(revenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      gross: Number(gross.toFixed(2)),
      margin: Number(margin.toFixed(2))
    };
  }, [rows]);

  const run = async () => {
    try {
      const params = new URLSearchParams({
        type,
        from: fromDate,
        to: toDate,
        compare_prev: String(comparePrev)
      });
      const res = await apiFetch(`/reports/run?${params.toString()}`);
      setRows(Array.isArray(res?.data?.rows) ? res.data.rows : []);
      const at = new Date(res?.data?.meta?.generated_at || Date.now());
      setGeneratedAt(at);
      setMsg(`${t("Report generated")}: ${type}${fromDate || toDate ? ` (${fromDate || "-"} ${t("to")} ${toDate || "-"})` : ""}`);
      const historyRes = await apiFetch("/reports/history");
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
    } catch (err) {
      setMsg(`${t("Run failed")}: ${err.message}`);
    }
  };

  const exportReport = async () => {
    try {
      const res = await apiFetch("/reports/export", {
        method: "POST",
        body: JSON.stringify({ type, format: exportFormat })
      });
      const file = res?.data || {};
      const resolvedFormat = String(file.format || exportFormat).toUpperCase();
      const mime =
        resolvedFormat === "CSV"
          ? "text/csv;charset=utf-8;"
          : resolvedFormat === "PDF"
            ? "application/pdf"
            : resolvedFormat === "XLSX"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/plain;charset=utf-8;";
      const blob =
        file.encoding === "base64"
          ? new Blob(
              [
                Uint8Array.from(atob(String(file.content || "")), (char) => char.charCodeAt(0))
              ],
              { type: mime }
            )
          : new Blob([String(file.content || "")], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename || `report-${type}.${resolvedFormat.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`${t("Export prepared in")} ${exportFormat} ${t("format.")}`);
    } catch (err) {
      setMsg(`${t("Export failed")}: ${err.message}`);
    }
  };

  const saveSchedule = async () => {
    if (schedule !== "NONE" && !toEmail.trim()) {
      setMsg(t("Please provide recipient email for scheduled reports."));
      return;
    }
    try {
      await apiFetch("/reports/schedule", {
        method: "POST",
        body: JSON.stringify({ type, schedule, to_email: toEmail })
      });
      setMsg(schedule === "NONE" ? t("Schedule disabled.") : `${t("Report schedule saved")}: ${schedule} ${t("to")} ${toEmail}.`);
    } catch (err) {
      setMsg(`${t("Save schedule failed")}: ${err.message}`);
    }
  };

  return (
    <Layout title="Reports">
      <section className="hero">
        <h2>{t("Reports Center")}</h2>
        <p>{t("Business reporting with finance, comparison, export and schedule controls.")}</p>
      </section>

      <section className="grid grid-4 reports-kpis">
        <article className="kpi"><div className="kpi-label">{t("Revenue")}</div><div className="kpi-value">${summary.revenue.toFixed(2)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("COGS")}</div><div className="kpi-value">${summary.cogs.toFixed(2)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Gross Profit")}</div><div className="kpi-value">${summary.gross.toFixed(2)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Margin")}</div><div className="kpi-value">{summary.margin.toFixed(2)}%</div></article>
      </section>

      <section className="card">
        <div className="row reports-toolbar">
          <div>
            <label>{t("Report Type")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="sales-daily">{t("Sales Daily")}</option>
              <option value="sales-monthly">{t("Sales Monthly")}</option>
              <option value="sales-quarterly">{t("Sales Quarterly")}</option>
              <option value="sales-annual">{t("Sales Annual")}</option>
              <option value="stock-low">{t("Stock Low")}</option>
              <option value="stock-expiry">{t("Stock Expiry")}</option>
              <option value="ai-reorder">{t("AI Reorder")}</option>
              <option value="category-contrib">{t("Category Contribution")}</option>
              <option value="payment-method">{t("Payment Method")}</option>
            </select>
          </div>
          <div>
            <label>{t("Date From")}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label>{t("Date To")}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label>{t("Compare Previous Period")}</label>
            <select value={comparePrev ? "YES" : "NO"} onChange={(e) => setComparePrev(e.target.value === "YES")}>
              <option value="YES">{t("YES")}</option>
              <option value="NO">{t("NO")}</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={run}>{t("Run Report")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Export Options")}</h3>
        </div>
        <div className="row reports-export-row">
          <div>
            <label>{t("Format")}</label>
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <option value="PDF">PDF</option>
              <option value="CSV">CSV</option>
              <option value="XLSX">XLSX</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={exportReport}>{t("Export")}</button>
          </div>
          <div>
            <label>{t("Quick Action")}</label>
            <button type="button" className="secondary" onClick={() => window.print()}>{t("Print Preview")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Scheduled Delivery")}</h3>
        </div>
        <div className="row reports-schedule-row">
          <div>
            <label>{t("Schedule")}</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              <option value="NONE">{t("NONE")}</option>
              <option value="DAILY_09">{t("Daily 09:00")}</option>
              <option value="WEEKLY_MON_09">{t("Weekly Monday 09:00")}</option>
            </select>
          </div>
          <div>
            <label>{t("Recipient Email")}</label>
            <input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder={t("owner@shop.com")} />
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={saveSchedule}>{t("Save Schedule")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Report Result")}</h3>
        </div>
        <DataTable className="reports-table" columns={columns} rows={tableRows} emptyText="No data" />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Report Metadata")}</h3>
        <div className="grid grid-2">
          <div className="stock-product-preview">
            <strong>{t("Generated By")}</strong>
            <span>{generatedBy}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Generated At")}</strong>
            <span>{generatedAt ? generatedAt.toLocaleString() : "-"}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Filters")}</strong>
            <span>{fromDate || "-"} to {toDate || "-"}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Comparison Enabled")}</strong>
            <span>{comparePrev ? t("YES") : t("NO")}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Report Run History")}</h3>
        <DataTable
          className="reports-table"
          columns={[t("Type"), t("Generated At"), t("Generated By"), t("Filters"), t("Compare"), t("Action")]}
          rows={history.map((h) => [
            h.type || h.report_type || "-",
            h.at || h.generated_at || "-",
            h.by || h.generated_by || "-",
            h.filter || h.filter_text || "-",
            t(h.compare || (h.compare_prev ? "YES" : "NO")),
            <button key={h.id} type="button" className="btn-inline">{t("Open")}</button>
          ])}
          emptyText={t("No report history yet")}
        />
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
