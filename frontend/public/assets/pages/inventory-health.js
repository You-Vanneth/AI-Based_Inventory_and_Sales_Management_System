App.requireAuth();
App.renderNav("inventory-health");
const tr = App.t;


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function priorityChip(daysLeft) {
  const days = Number(daysLeft ?? 999);
  if (days <= 3) return '<span class="chip danger">Critical</span>';
  if (days <= 7) return '<span class="chip warning">High</span>';
  if (days <= 14) return '<span class="chip">Medium</span>';
  return '<span class="chip">Normal</span>';
}

function renderCards(lowItems, expiryItems) {
  const outOfStock = lowItems.filter((x) => Number(x.quantity || 0) <= 0).length;
  const criticalExpiry = expiryItems.filter((x) => Number(x.days_left ?? 999) <= 3).length;

  document.getElementById("healthCards").innerHTML = `
    <article class="kpi"><div class="kpi-label">${tr("Low Stock Items")}</div><div class="kpi-value">${lowItems.length}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Expiring Soon")}</div><div class="kpi-value">${expiryItems.length}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Out of Stock")}</div><div class="kpi-value">${outOfStock}</div></article>
    <article class="kpi"><div class="kpi-label">${tr("Critical Expiry")}</div><div class="kpi-value">${criticalExpiry}</div></article>
  `;
}

function renderExpiry(items) {
  const body = document.getElementById("expiryBody");
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${tr("No expiring products in this window.")}</td></tr>`;
    return;
  }

  body.innerHTML = items
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.product_name)}</td>
        <td>${escapeHtml(row.barcode || "-")}</td>
        <td>${Number(row.quantity || 0)}</td>
        <td>${escapeHtml(row.expiry_date || "-")}</td>
        <td>${Number(row.days_left || 0)}</td>
        <td>${priorityChip(row.days_left)}</td>
      </tr>
    `)
    .join("");
}

function renderLow(items) {
  const body = document.getElementById("lowBody");
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${tr("All products are above minimum stock.")}</td></tr>`;
    return;
  }

  body.innerHTML = items
    .map((row) => {
      const qty = Number(row.quantity || 0);
      const min = Number(row.min_stock_level || 0);
      const gap = Math.max(0, min - qty);
      const action = gap > 0 ? `${tr("Reorder")}: +${gap}` : tr("Monitor");
      return `
        <tr>
          <td>${escapeHtml(row.product_name)}</td>
          <td>${escapeHtml(row.category_name || "-")}</td>
          <td>${qty}</td>
          <td>${min}</td>
          <td>${gap}</td>
          <td>${escapeHtml(action)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadHealth() {
  const expiryMsg = document.getElementById("expiryMsg");
  const lowMsg = document.getElementById("lowMsg");
  expiryMsg.innerHTML = "";
  lowMsg.innerHTML = "";

  const windowDays = Number(document.getElementById("expiryWindow").value || 30);

  try {
    const [lowRes, expiryRes] = await Promise.all([
      App.apiFetch("/reports/stock/low"),
      App.apiFetch("/reports/stock/expiry")
    ]);

    const lowItems = Array.isArray(lowRes.data) ? lowRes.data : [];
    const expiryRaw = Array.isArray(expiryRes.data) ? expiryRes.data : [];
    const expiryItems = expiryRaw
      .filter((x) => Number(x.days_left ?? 9999) <= windowDays)
      .sort((a, b) => Number(a.days_left ?? 9999) - Number(b.days_left ?? 9999));

    renderCards(lowItems, expiryItems);
    renderExpiry(expiryItems);
    renderLow(lowItems);
  } catch (error) {
    expiryMsg.innerHTML = `<div class="msg error">${escapeHtml(error.message)}</div>`;
    lowMsg.innerHTML = `<div class="msg error">${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById("refreshHealth").addEventListener("click", loadHealth);
document.getElementById("expiryWindow").addEventListener("change", loadHealth);

loadHealth();
