App.requireAuth();
App.renderNav("ai");
const tr = App.t;

async function runForecast() {
  const msg = document.getElementById("forecastMsg");
  const card = document.getElementById("forecastCard");
  msg.innerHTML = "";
  try {
    const productId = Number(document.getElementById("productId").value);
    const days = Number(document.getElementById("days").value);
    const lead = Number(document.getElementById("lead").value);
    const res = await App.apiFetch(`/ai/forecast/products/${productId}?days=${days}&lead_time=${lead}`);
    const x = res.data;

    card.innerHTML = `
      <article class="kpi"><div class="kpi-label">${tr("Product")}</div><div class="kpi-value">${x.product_name || x.product_id}</div></article>
      <article class="kpi"><div class="kpi-label">${tr("Average/Day")}</div><div class="kpi-value">${x.average_daily_sales}</div></article>
      <article class="kpi"><div class="kpi-label">${tr("Reorder Level")}</div><div class="kpi-value">${x.reorder_level}</div></article>
      <article class="kpi"><div class="kpi-label">${tr("Suggest Qty")}</div><div class="kpi-value">${x.suggested_purchase_qty}</div></article>
    `;
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

async function loadReorder() {
  const msg = document.getElementById("reorderMsg");
  const body = document.getElementById("reorderBody");
  msg.innerHTML = "";
  try {
    const days = Number(document.getElementById("days").value);
    const lead = Number(document.getElementById("lead").value);
    const res = await App.apiFetch(`/ai/reorder-recommendations?days=${days}&lead_time=${lead}`);
    body.innerHTML = (res.data || []).map((x) => `
      <tr>
        <td>${x.product_name || x.product_id}</td>
        <td>${x.average_daily_sales}</td>
        <td>${x.lead_time_days}</td>
        <td>${x.reorder_level}</td>
        <td>${x.current_stock}</td>
        <td>${x.suggested_purchase_qty}</td>
      </tr>
    `).join("");
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

document.getElementById("forecastBtn").addEventListener("click", runForecast);
document.getElementById("reorderBtn").addEventListener("click", loadReorder);
runForecast();
loadReorder();
