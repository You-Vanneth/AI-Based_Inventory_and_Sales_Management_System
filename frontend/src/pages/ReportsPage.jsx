import React from "react";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const SALES_GROUP_TO_TYPE = {
  DAY: "sales-daily",
  MONTH: "sales-monthly",
  QUARTER: "sales-quarterly",
  YEAR: "sales-annual"
};

function deriveReportControls(type) {
  if (type.startsWith("sales-")) {
    if (type === "sales-monthly") return { category: "sales", grouping: "MONTH" };
    if (type === "sales-quarterly") return { category: "sales", grouping: "QUARTER" };
    if (type === "sales-annual") return { category: "sales", grouping: "YEAR" };
    return { category: "sales", grouping: "DAY" };
  }
  if (type === "stock-low") return { category: "stock-low", grouping: "DAY" };
  if (type === "stock-expiry") return { category: "stock-expiry", grouping: "DAY" };
  if (type === "ai-reorder") return { category: "ai-reorder", grouping: "DAY" };
  if (type === "category-contrib") return { category: "category-contrib", grouping: "DAY" };
  if (type === "payment-method") return { category: "payment-method", grouping: "DAY" };
  return { category: "sales", grouping: "DAY" };
}

function resolveReportType(category, grouping) {
  if (category === "sales") return SALES_GROUP_TO_TYPE[grouping] || "sales-daily";
  return category;
}

function getGroupingLabel(grouping) {
  if (grouping === "MONTH") return "Month";
  if (grouping === "QUARTER") return "Quarter";
  if (grouping === "YEAR") return "Year";
  return "Day";
}

function getCategoryLabel(category) {
  if (category === "stock-low") return "Stock Low";
  if (category === "stock-expiry") return "Stock Expiry";
  if (category === "ai-reorder") return "AI Reorder";
  if (category === "category-contrib") return "Category Contribution";
  if (category === "payment-method") return "Payment Method";
  return "Sales";
}

function parseDateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function formatDateParts(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getLastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeSalesDateRange(grouping, from, to) {
  if (!from && !to) return { from: "", to: "" };
  const baseFrom = parseDateParts(from || to);
  const baseTo = parseDateParts(to || from);
  if (!baseFrom || !baseTo) return { from, to };

  if (grouping === "MONTH") {
    return {
      from: formatDateParts(baseFrom.year, baseFrom.month, 1),
      to: formatDateParts(baseTo.year, baseTo.month, getLastDayOfMonth(baseTo.year, baseTo.month))
    };
  }

  if (grouping === "QUARTER") {
    const fromQuarterStartMonth = Math.floor((baseFrom.month - 1) / 3) * 3 + 1;
    const toQuarterStartMonth = Math.floor((baseTo.month - 1) / 3) * 3 + 1;
    const toQuarterEndMonth = toQuarterStartMonth + 2;
    return {
      from: formatDateParts(baseFrom.year, fromQuarterStartMonth, 1),
      to: formatDateParts(baseTo.year, toQuarterEndMonth, getLastDayOfMonth(baseTo.year, toQuarterEndMonth))
    };
  }

  if (grouping === "YEAR") {
    return {
      from: formatDateParts(baseFrom.year, 1, 1),
      to: formatDateParts(baseTo.year, 12, 31)
    };
  }

  return { from, to };
}

export default function ReportsPage() {
  const [type, setType] = useState("sales-daily");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [comparePrev, setComparePrev] = useState(true);
  const [exportFormat, setExportFormat] = useState("PDF");
  const [schedule, setSchedule] = useState("NONE");
  const [toEmail, setToEmail] = useState("");
  const [runMeta, setRunMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");
  const [rows, setRows] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const reportControls = useMemo(() => deriveReportControls(type), [type]);
  const isSalesReport = reportControls.category === "sales";
  const groupingLabel = useMemo(() => getGroupingLabel(reportControls.grouping), [reportControls.grouping]);
  const categoryLabel = useMemo(() => getCategoryLabel(reportControls.category), [reportControls.category]);
  const selectedPeriodLabel = `${fromDate || "-"} ${t("to")} ${toDate || "-"}`;
  const effectiveRange = useMemo(
    () => (isSalesReport ? normalizeSalesDateRange(reportControls.grouping, fromDate, toDate) : { from: fromDate, to: toDate }),
    [isSalesReport, reportControls.grouping, fromDate, toDate]
  );
  const effectivePeriodLabel = `${effectiveRange.from || "-"} ${t("to")} ${effectiveRange.to || "-"}`;

  const parseHistoryFilter = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^(.+?)\s+to\s+(.+)$/i);
    if (!match) return { from: "", to: "" };
    return {
      from: match[1] === "-" ? "" : match[1],
      to: match[2] === "-" ? "" : match[2]
    };
  };

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
        <button
          key={`${type}-${String(r[keys[0]])}`}
          type="button"
          className="btn-inline"
          onClick={() => setDetailRow(r)}
        >
          {t("Drill Down")}
        </button>
      ])
    };
  }, [rows, type]);

  const summary = useMemo(() => {
    const revenue = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const cogs = rows.reduce((sum, r) => sum + Number(r.cogs || 0), 0);
    const gross = revenue - cogs;
    const margin = revenue ? (gross / revenue) * 100 : 0;
    return {
      revenue: Number(revenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      gross: Number(gross.toFixed(2)),
      margin: Number(margin.toFixed(2))
    };
  }, [rows]);

  const runReport = async ({ nextType = type, nextFrom = fromDate, nextTo = toDate, nextComparePrev = comparePrev } = {}) => {
    try {
      const nextControls = deriveReportControls(nextType);
      const normalizedRange = nextControls.category === "sales"
        ? normalizeSalesDateRange(nextControls.grouping, nextFrom, nextTo)
        : { from: nextFrom, to: nextTo };
      const params = new URLSearchParams({
        type: nextType,
        from: normalizedRange.from,
        to: normalizedRange.to,
        compare_prev: String(nextComparePrev)
      });
      const res = await apiFetch(`/reports/run?${params.toString()}`);
      const nextRows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      const nextMeta = res?.data?.meta || null;
      setRows(nextRows);
      setComparison(nextMeta?.comparison || null);
      setRunMeta(nextMeta);
      setMsgType(nextRows.length ? "ok" : "error");
      setMsg(
        nextRows.length
          ? `${t("Report generated")}: ${nextType}${normalizedRange.from || normalizedRange.to ? ` (${normalizedRange.from || "-"} ${t("to")} ${normalizedRange.to || "-"})` : ""}`
          : t("No report rows found for the selected filters.")
      );
      const historyRes = await apiFetch("/reports/history");
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
    } catch (err) {
      setRows([]);
      setComparison(null);
      setRunMeta(null);
      setMsgType("error");
      setMsg(`${t("Run failed")}: ${err.message}`);
    }
  };

  const run = async () => {
    await runReport();
  };

  const openHistoryRun = async (entry) => {
    const nextType = String(entry.type || entry.report_type || type);
    const parsedFilter = parseHistoryFilter(entry.filter || entry.filter_text || "");
    const nextComparePrev = Boolean(entry.compare_prev || entry.compare === "YES");
    setType(nextType);
    setFromDate(parsedFilter.from);
    setToDate(parsedFilter.to);
    setComparePrev(nextComparePrev);
    await runReport({
      nextType,
      nextFrom: parsedFilter.from,
      nextTo: parsedFilter.to,
      nextComparePrev
    });
    setMsgType("ok");
    setMsg(t("Report reopened from history."));
  };

  useEffect(() => {
    setRows([]);
    setComparison(null);
    setRunMeta(null);
    setDetailRow(null);
    setMsg("");
    setMsgType("ok");
  }, [type]);

  const exportReport = async () => {
    try {
      const res = await apiFetch("/reports/export", {
        method: "POST",
        body: JSON.stringify({
          type,
          format: exportFormat,
          from: fromDate,
          to: toDate,
          compare_prev: comparePrev
        })
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
      setMsgType("ok");
      setMsg(`${t("Export prepared in")} ${exportFormat} ${t("format.")}`);
    } catch (err) {
      setMsgType("error");
      setMsg(`${t("Export failed")}: ${err.message}`);
    }
  };

  const saveSchedule = async () => {
    if (schedule !== "NONE" && !toEmail.trim()) {
      setMsgType("error");
      setMsg(t("Please provide recipient email for scheduled reports."));
      return;
    }
    try {
      await apiFetch("/reports/schedule", {
        method: "POST",
        body: JSON.stringify({ type, schedule, to_email: toEmail })
      });
      setMsgType("ok");
      setMsg(schedule === "NONE" ? t("Schedule disabled.") : `${t("Report schedule saved")}: ${schedule} ${t("to")} ${toEmail}.`);
    } catch (err) {
      setMsgType("error");
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
        <article className="kpi"><div className="kpi-label">{t("Report Category")}</div><div className="kpi-value">{t(categoryLabel)}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Grouped By")}</div><div className="kpi-value">{isSalesReport ? t(groupingLabel) : "-"}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Rows Returned")}</div><div className="kpi-value">{rows.length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Selected Period")}</div><div className="kpi-value">{effectivePeriodLabel}</div></article>
      </section>

      {isSalesReport ? (
        <section className="grid grid-4 reports-kpis">
          <article className="kpi"><div className="kpi-label">{t("Total Revenue")}</div><div className="kpi-value">${summary.revenue.toFixed(2)}</div></article>
          <article className="kpi"><div className="kpi-label">{t("Total COGS")}</div><div className="kpi-value">${summary.cogs.toFixed(2)}</div></article>
          <article className="kpi"><div className="kpi-label">{t("Total Gross Profit")}</div><div className="kpi-value">${summary.gross.toFixed(2)}</div></article>
          <article className="kpi"><div className="kpi-label">{t("Total Margin")}</div><div className="kpi-value">{summary.margin.toFixed(2)}%</div></article>
        </section>
      ) : null}

      <p className="muted" style={{ marginTop: 12 }}>
        {isSalesReport
          ? t("Changing Group By also expands the sales date range to full month, quarter or year boundaries so the result is easier to compare.")
          : t("The cards above show the selected report, returned rows and selected period.")}
      </p>

      {comparePrev && comparison ? (
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">{t("Comparison Summary")}</h3>
          </div>
          <div className="grid grid-4 reports-kpis">
            <article className="kpi">
              <div className="kpi-label">{t(comparison.current?.primary_label || "Current")}</div>
              <div className="kpi-value">{comparison.current?.primary_value ?? 0}</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">{t("Previous Period")}</div>
              <div className="kpi-value">{comparison.previous?.primary_value ?? 0}</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">{t("Delta")}</div>
              <div className="kpi-value">{comparison.delta ?? 0}</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">{t("Delta %")}</div>
              <div className="kpi-value">{comparison.delta_pct == null ? "-" : `${comparison.delta_pct}%`}</div>
            </article>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {t("Previous period")}: {comparison.previous_from} {t("to")} {comparison.previous_to}
          </p>
        </section>
      ) : null}

      <section className="card">
        <div className="row reports-toolbar">
          <div>
            <label>{t("Report Category")}</label>
            <select
              value={reportControls.category}
              onChange={(e) => setType(resolveReportType(e.target.value, reportControls.grouping))}
            >
              <option value="sales">{t("Sales")}</option>
              <option value="stock-low">{t("Stock Low")}</option>
              <option value="stock-expiry">{t("Stock Expiry")}</option>
              <option value="ai-reorder">{t("AI Reorder")}</option>
              <option value="category-contrib">{t("Category Contribution")}</option>
              <option value="payment-method">{t("Payment Method")}</option>
            </select>
          </div>
          {isSalesReport ? (
            <div>
              <label>{t("Group By")}</label>
              <select
                value={reportControls.grouping}
                onChange={(e) => setType(resolveReportType(reportControls.category, e.target.value))}
              >
                <option value="DAY">{t("Day")}</option>
                <option value="MONTH">{t("Month")}</option>
                <option value="QUARTER">{t("Quarter")}</option>
                <option value="YEAR">{t("Year")}</option>
              </select>
            </div>
          ) : null}
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
        <p className="muted" style={{ marginTop: 12 }}>
          {isSalesReport
            ? `${t("Date From and Date To act as anchors. Group By Month, Quarter and Year will expand to full period boundaries before running the report.")}`
            : t("Use date filters to limit the selected report to a specific period.")}
        </p>
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
        {!rows.length && runMeta ? <div className="msg error">{t("No report rows found for the selected filters.")}</div> : null}
        <DataTable className="reports-table" columns={columns} rows={tableRows} emptyText={t("Run a report to see results")} />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Report Metadata")}</h3>
        <div className="grid grid-2">
          <div className="stock-product-preview">
            <strong>{t("Generated By")}</strong>
            <span>{runMeta?.generated_by || "-"}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Generated At")}</strong>
            <span>{runMeta?.generated_at ? new Date(runMeta.generated_at).toLocaleString() : "-"}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Filters")}</strong>
            <span>{runMeta?.filter || `${fromDate || "-"} ${t("to")} ${toDate || "-"}`}</span>
          </div>
          <div className="stock-product-preview">
            <strong>{t("Comparison Enabled")}</strong>
            <span>{(runMeta?.compare_prev ?? comparePrev) ? t("YES") : t("NO")}</span>
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
            <button key={h.id} type="button" className="btn-inline" onClick={() => openHistoryRun(h)}>{t("Open")}</button>
          ])}
          emptyText={t("No report history yet")}
        />
      </section>

      <Modal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title={t("Report Row Detail")}
        size="wide"
      >
        {detailRow ? (
          <div className="grid">
            <div className="msg ok">
              <strong>{t("Selected report row details.")}</strong>
            </div>
            <div className="grid grid-2">
              {Object.entries(detailRow).map(([key, value]) => (
                <div key={key} className="stock-product-preview">
                  <strong>{t(key)}</strong>
                  <span>{String(value ?? "-")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {msg ? <div className={`msg ${msgType === "error" ? "error" : "ok"}`}>{msg}</div> : null}
    </Layout>
  );
}
