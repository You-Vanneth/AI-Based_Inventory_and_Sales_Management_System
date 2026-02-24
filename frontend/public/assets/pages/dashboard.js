App.requireAuth();
App.renderNav("dashboard");
const tr = App.t;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSummary(summary) {
  const cards = document.getElementById("cards");
  const role = App.getUser()?.role || "-";
  cards.innerHTML = `
    <article class="kpi"><div class="kpi-label">${tr("Total Products")}</div><div class="kpi-value">${summary.total_products ?? 0}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Sales Today")}</div><div class="kpi-value">${currency.format(Number(summary.total_sales_today ?? 0))}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Monthly Revenue")}</div><div class="kpi-value">${currency.format(Number(summary.monthly_revenue ?? 0))}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Low Stock Items")}</div><div class="kpi-value">${summary.low_stock_count ?? 0}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Expiring Soon")}</div><div class="kpi-value">${summary.expiring_soon_count ?? 0}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Active Role")}</div><div class="kpi-value">${escapeHtml(role)}</div></article>
  `;
}

function getLast14Dates() {
  const out = [];
  const today = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function renderSalesTrend(rows) {
  const target = document.getElementById("salesTrendChart");
  const map = new Map((rows || []).map((r) => [String(r.sale_date).slice(0, 10), Number(r.total_sales || 0)]));
  const dates = getLast14Dates();
  const points = dates.map((d) => ({ date: d, total: map.get(d) || 0 }));
  const max = Math.max(...points.map((p) => p.total), 1);
  const width = 700;
  const height = 230;
  const padX = 24;
  const padY = 20;
  const graphW = width - padX * 2;
  const graphH = height - padY * 2;

  const plot = points
    .map((point, idx) => {
      const x = padX + (idx * graphW) / (points.length - 1 || 1);
      const y = padY + graphH - (point.total / max) * graphH;
      return { x, y, total: point.total };
    });

  const polyline = plot.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${height - padY} ${polyline} ${width - padX},${height - padY}`;
  const labels = points
    .filter((_, idx) => idx % 2 === 0 || idx === points.length - 1)
    .map((p, idx) => `<span>${escapeHtml(p.date.slice(5))}${idx < points.length - 1 ? "" : ""}</span>`)
    .join("");

  target.innerHTML = `
    <div class="trend-shell">
      <svg viewBox="0 0 ${width} ${height}" class="trend-svg" role="img" aria-label="${tr("Sales trend chart")}">
        <defs>
          <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.35"></stop>
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.03"></stop>
          </linearGradient>
        </defs>
        <polygon points="${area}" fill="url(#salesAreaGradient)"></polygon>
        <polyline points="${polyline}" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round"></polyline>
        ${plot
          .map(
            (p) =>
              `<circle cx="${p.x}" cy="${p.y}" r="4.2" fill="#0f172a"><title>${currency.format(p.total)}</title></circle>`
          )
          .join("")}
      </svg>
      <div class="trend-axis">${labels}</div>
    </div>
  `;
}

function renderCategoryBars(rows) {
  const target = document.getElementById("categoryBars");
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">${tr("No category sales yet.")}</div>`;
    return;
  }

  const max = Math.max(...items.map((i) => Number(i.total_sales || 0)), 1);
  target.innerHTML = items
    .map((item) => {
      const value = Number(item.total_sales || 0);
      const width = Math.max(5, (value / max) * 100);
      const bucket = Math.min(100, Math.max(5, Math.round(width / 5) * 5));
      return `
        <div class="bar-row">
          <div class="bar-head">
            <span>${escapeHtml(item.category_name)}</span>
            <strong>${currency.format(value)}</strong>
          </div>
          <div class="bar-track"><div class="bar-fill bar-fill-${bucket}"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderTopProducts(rows) {
  const target = document.getElementById("topProductsTable");
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">${tr("No sales data yet.")}</div>`;
    return;
  }

  target.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${tr("Product")}</th>
            <th>${tr("Units")}</th>
            <th>${tr("Sales")}</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (row) => `
            <tr>
              <td>${escapeHtml(row.product_name)}</td>
              <td>${Number(row.total_units || 0)}</td>
              <td>${currency.format(Number(row.total_sales || 0))}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLowStock(rows) {
  const target = document.getElementById("lowStockTable");
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">${tr("All products are above minimum stock.")}</div>`;
    return;
  }

  target.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${tr("Product")}</th>
            <th>${tr("Barcode")}</th>
            <th>${tr("Qty")}</th>
            <th>${tr("Min")}</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (row) => `
            <tr>
              <td>${escapeHtml(row.product_name)}</td>
              <td>${escapeHtml(row.barcode || "-")}</td>
              <td>${Number(row.quantity || 0)}</td>
              <td>${Number(row.min_stock_level || 0)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadDashboard() {
  const msg = document.getElementById("msg");
  try {
    const summaryRes = await App.apiFetch("/dashboard/summary");
    renderSummary(summaryRes.data || {});

    try {
      const analyticsRes = await App.apiFetch("/dashboard/analytics");
      const analytics = analyticsRes.data || {};
      renderSalesTrend(analytics.daily_sales || []);
      renderCategoryBars(analytics.category_sales || []);
      renderTopProducts(analytics.top_products || []);
      renderLowStock(analytics.low_stock_items || []);
    } catch (analyticsError) {
      document.getElementById("salesTrendChart").innerHTML =
        `<div class="empty-state">${tr("Analytics endpoint is not available yet.")}</div>`;
      document.getElementById("categoryBars").innerHTML =
        `<div class="empty-state">${tr("Analytics endpoint is not available yet.")}</div>`;
      document.getElementById("topProductsTable").innerHTML =
        `<div class="empty-state">${tr("Analytics endpoint is not available yet.")}</div>`;
      document.getElementById("lowStockTable").innerHTML =
        `<div class="empty-state">${tr("Analytics endpoint is not available yet.")}</div>`;
      msg.innerHTML = `<div class="msg error">${escapeHtml(analyticsError.message)}</div>`;
    }
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(error.message)}</div>`;
  }
}

loadDashboard();
