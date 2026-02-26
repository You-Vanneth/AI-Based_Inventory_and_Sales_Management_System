import React from "react";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiFetch("/dashboard/summary")
      .then((res) => setSummary(res.data || {}))
      .catch((e) => setErr(e.message));
  }, []);

  const kpi = [
    ["Total Products", summary?.total_products ?? 0],
    ["Sales Today", summary?.total_sales_today ?? 0],
    ["Monthly Revenue", summary?.monthly_revenue ?? 0],
    ["Low Stock Items", summary?.low_stock_count ?? 0],
    ["Expiring Soon", summary?.expiring_soon_count ?? 0]
  ];

  return (
    <Layout title="Dashboard">
      <section className="hero">
        <h2>{t("Operations Dashboard")}</h2>
        <p>{t("Quick business visibility.")}</p>
      </section>
      <section className="grid grid-4">
        {kpi.map(([label, value]) => (
          <article className="kpi" key={label}>
            <div className="kpi-label">{t(label)}</div>
            <div className="kpi-value">{value}</div>
          </article>
        ))}
      </section>
      {err ? <div className="msg error">{err}</div> : null}
    </Layout>
  );
}
