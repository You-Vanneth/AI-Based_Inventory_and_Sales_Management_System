import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const fallback = {
  total_products: 132,
  total_sales_today: 48,
  transactions_today: 63,
  monthly_revenue: 2860.35,
  cogs_monthly: 1960.2,
  gross_profit_monthly: 900.15,
  profit_margin_pct: 31.47,
  low_stock_count: 7,
  expiring_soon_count: 4,
  inventory_turnover_ratio: 4.6,
  dead_stock_count: 9,
  stock_distribution: { adequate: 91, low: 26, critical: 9, out: 6 },
  payment_breakdown: [
    { method: "CASH", amount: 1885.8 },
    { method: "BANK_TRANSFER", amount: 974.55 }
  ],
  sales_7d: [
    { day: "Mon", amount: 322 },
    { day: "Tue", amount: 284 },
    { day: "Wed", amount: 345 },
    { day: "Thu", amount: 298 },
    { day: "Fri", amount: 412 },
    { day: "Sat", amount: 460 },
    { day: "Sun", amount: 396 }
  ],
  top_products: [
    { product_name: "Coca Cola 330ml", sold_qty: 84, revenue: 63.0 },
    { product_name: "Instant Noodle", sold_qty: 72, revenue: 32.4 },
    { product_name: "UHT Milk", sold_qty: 61, revenue: 73.2 },
    { product_name: "Soy Sauce", sold_qty: 46, revenue: 41.4 }
  ],
  stock_alerts: [
    { product_name: "Instant Noodle", qty: 5, min_stock: 12, type: "LOW" },
    { product_name: "Fish Sauce", qty: 0, min_stock: 8, type: "OUT" },
    { product_name: "UHT Milk", qty: 8, min_stock: 10, type: "EXPIRY" }
  ]
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(fallback);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState("7d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [nowTick, setNowTick] = useState(new Date());

  const fetchSummary = () => {
    setLoading(true);
    setErr("");
    const params = new URLSearchParams();
    params.set("period", period);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    apiFetch(`/dashboard/summary?${params.toString()}`)
      .then((res) => {
        setSummary(res.data || fallback);
        setLastUpdated(new Date());
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (period === "custom" && (!fromDate || !toDate)) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fromDate, toDate]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const trend = summary?.sales_7d?.length ? summary.sales_7d : fallback.sales_7d;
  const peak = useMemo(() => Math.max(...trend.map((x) => Number(x.amount || 0)), 1), [trend]);
  const topProducts = summary?.top_products?.length ? summary.top_products : fallback.top_products;
  const alerts = summary?.stock_alerts?.length ? summary.stock_alerts : fallback.stock_alerts;
  const payment = summary?.payment_breakdown?.length ? summary.payment_breakdown : fallback.payment_breakdown;
  const paymentPeak = useMemo(() => Math.max(...payment.map((x) => Number(x.amount || 0)), 1), [payment]);
  const distribution = summary?.stock_distribution || fallback.stock_distribution;
  const distRows = [
    { label: "Adequate", value: Number(distribution?.adequate || 0) },
    { label: "Low", value: Number(distribution?.low || 0) },
    { label: "Critical", value: Number(distribution?.critical || 0) },
    { label: "Out", value: Number(distribution?.out || 0) }
  ];
  const distPeak = useMemo(() => Math.max(...distRows.map((x) => x.value), 1), [distRows]);

  const kpi = [
    ["Total Products", summary?.total_products ?? 0],
    ["Transactions Today", summary?.transactions_today ?? fallback.transactions_today],
    ["Sales Today", summary?.total_sales_today ?? 0],
    ["Monthly Revenue", `$${Number(summary?.monthly_revenue ?? 0).toFixed(2)}`],
    ["Low Stock Items", summary?.low_stock_count ?? 0],
    ["Expiring Soon", summary?.expiring_soon_count ?? 0]
  ];

  const secondsAgo = Math.max(0, Math.floor((nowTick.getTime() - lastUpdated.getTime()) / 1000));

  const exportCsv = () => {
    const lines = [
      "metric,value",
      `total_products,${summary?.total_products ?? 0}`,
      `transactions_today,${summary?.transactions_today ?? 0}`,
      `sales_today,${summary?.total_sales_today ?? 0}`,
      `monthly_revenue,${summary?.monthly_revenue ?? 0}`,
      `cogs_monthly,${summary?.cogs_monthly ?? 0}`,
      `gross_profit_monthly,${summary?.gross_profit_monthly ?? 0}`,
      `profit_margin_pct,${summary?.profit_margin_pct ?? 0}`,
      `low_stock_count,${summary?.low_stock_count ?? 0}`,
      `expiring_soon_count,${summary?.expiring_soon_count ?? 0}`
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Dashboard">
      <section className="hero dashboard-hero">
        <h2>{t("Operations Dashboard")}</h2>
        <p>{t("Quick business visibility.")}</p>
        <div className="dashboard-hero-controls mt-12">
          <div className="dashboard-filter-grid">
            <div>
              <label>{t("Range")}</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="7d">{t("Last 7 Days")}</option>
                <option value="30d">{t("Last 30 Days")}</option>
                <option value="custom">{t("Custom")}</option>
              </select>
            </div>
            <div>
              <label>{t("From")}</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={period !== "custom"} />
            </div>
            <div>
              <label>{t("To")}</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={period !== "custom"} />
            </div>
          </div>

          <div className="dashboard-actions-card">
            <div className="dashboard-actions-head">
              <span className="dashboard-actions-label">{t("Action")}</span>
              <div className="dashboard-live-pill">
                <span>{t("Live status: updated")}</span>
                <strong>{secondsAgo}s {t("ago")}</strong>
              </div>
            </div>

            <div className="dashboard-actions-row">
              <button type="button" onClick={fetchSummary}>{loading ? t("Refreshing...") : t("Refresh")}</button>
              <button type="button" className="secondary" onClick={exportCsv}>{t("Export CSV")}</button>
            </div>
          </div>
        </div>
      </section>
      <section className="grid grid-4">
        {kpi.map(([label, value]) => (
          <article className="kpi" key={label}>
            <div className="kpi-label">{t(label)}</div>
            <div className="kpi-value">{value}</div>
          </article>
        ))}
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Sales Trend")}</h3>
          <div className="trend-shell">
            {trend.map((x) => {
              const pct = Math.max(5, Math.round((Number(x.amount || 0) / peak) * 100));
              return (
                <div key={x.day} className="bar-row">
                  <div className="bar-head">
                    <span>{t(x.day)}</span>
                    <strong>${Number(x.amount || 0).toFixed(2)}</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Top Selling Products")}</h3>
          <div className="trend-shell">
            {topProducts.map((x, idx) => (
              <div key={`${x.product_name}-${idx}`} className="bar-row">
                <div className="bar-head">
                  <span>{x.product_name}</span>
                  <strong>{x.sold_qty} {t("sold")} | ${Number(x.revenue || 0).toFixed(2)}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(10, Math.round((Number(x.sold_qty || 0) / Number(topProducts[0]?.sold_qty || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-4">
        <article className="kpi">
          <div className="kpi-label">{t("COGS")}</div>
          <div className="kpi-value">${Number(summary?.cogs_monthly ?? fallback.cogs_monthly).toFixed(2)}</div>
        </article>
        <article className="kpi">
          <div className="kpi-label">{t("Gross Profit")}</div>
          <div className="kpi-value">${Number(summary?.gross_profit_monthly ?? fallback.gross_profit_monthly).toFixed(2)}</div>
        </article>
        <article className="kpi">
          <div className="kpi-label">{t("Profit Margin")}</div>
          <div className="kpi-value">{Number(summary?.profit_margin_pct ?? fallback.profit_margin_pct).toFixed(2)}%</div>
        </article>
        <article className="kpi">
          <div className="kpi-label">{t("Inventory Turnover")}</div>
          <div className="kpi-value">{Number(summary?.inventory_turnover_ratio ?? fallback.inventory_turnover_ratio).toFixed(2)}x</div>
        </article>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Payment Method Distribution")}</h3>
          <div className="trend-shell">
            {payment.map((x, idx) => (
              <div key={`${x.method}-${idx}`} className="bar-row">
                <div className="bar-head">
                  <span>{t(x.method)}</span>
                  <strong>${Number(x.amount || 0).toFixed(2)}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(8, Math.round((Number(x.amount || 0) / paymentPeak) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Inventory Distribution")}</h3>
          <div className="trend-shell">
            {distRows.map((x) => (
              <div key={x.label} className="bar-row">
                <div className="bar-head">
                  <span>{t(x.label)}</span>
                  <strong>{x.value}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(8, Math.round((x.value / distPeak) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <div className="kpi-label">{t("Dead Stock")}</div>
            <strong>{summary?.dead_stock_count ?? fallback.dead_stock_count} {t("products")}</strong>
          </div>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Stock Risk Alerts")}</h3>
        <div className="grid grid-2">
          {alerts.map((x, idx) => (
            <div key={`${x.product_name}-${idx}`} className="stock-product-preview">
              <strong>{x.product_name}</strong>
              <span>{t("Current Qty")}: {x.qty}</span>
              <span>{t("Min Level")}: {x.min_stock}</span>
              <span>
                {t("Priority")}:{" "}
                <span className={`chip ${x.type === "OUT" ? "danger" : x.type === "LOW" ? "warning" : ""}`}>
                  {t(x.type)}
                </span>
              </span>
              <div className="row mt-8">
                <button type="button" className="btn-inline" onClick={() => navigate("/inventory-health")}>{t("View Inventory")}</button>
                <button type="button" className="btn-inline secondary" onClick={() => navigate("/products")}>{t("Open Product")}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Drill-Down Actions")}</h3>
        </div>
        <div className="row">
          <button type="button" onClick={() => navigate("/reports")}>{t("Open Business Reports")}</button>
          <button type="button" className="secondary" onClick={() => navigate("/sales")}>{t("Open Sales Console")}</button>
          <button type="button" className="secondary" onClick={() => navigate("/notifications")}>{t("Open Alerts")}</button>
        </div>
      </section>
      {err ? <div className="msg error">{err}</div> : null}
    </Layout>
  );
}
