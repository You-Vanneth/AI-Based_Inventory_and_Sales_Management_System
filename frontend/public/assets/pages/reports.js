App.requireAuth();
App.renderNav("reports");
const tr = App.t;

const msg = document.getElementById("msg");
const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");

function renderTable(columns, rows) {
  thead.innerHTML = `<tr>${columns.map((c) => `<th>${tr(c)}</th>`).join("")}</tr>`;
  tbody.innerHTML = rows.map((r) => `<tr>${r.map((v) => `<td>${v ?? "-"}</td>`).join("")}</tr>`).join("");
}

async function runReport() {
  msg.innerHTML = "";
  const reportType = document.getElementById("reportType").value;
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;

  let path = "";
  if (reportType === "sales-daily") path = `/reports/sales/daily?date_from=${dateFrom}&date_to=${dateTo}`;
  if (reportType === "sales-monthly") path = `/reports/sales/monthly?date_from=${dateFrom}&date_to=${dateTo}`;
  if (reportType === "stock-low") path = "/reports/stock/low";
  if (reportType === "stock-expiry") path = "/reports/stock/expiry";
  if (reportType === "ai-reorder") path = "/reports/ai/reorder-suggestions";

  try {
    const res = await App.apiFetch(path);
    const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);

    if (reportType === "sales-daily") {
      renderTable(["Date", "Txns", "Units", "Amount"], data.map((x) => [x.sale_date, x.total_transactions, x.total_units_sold, x.total_sales_amount]));
    } else if (reportType === "sales-monthly") {
      renderTable(["Month", "Txns", "Units", "Amount"], data.map((x) => [x.sale_month, x.total_transactions, x.total_units_sold, x.total_sales_amount]));
    } else if (reportType === "stock-low") {
      renderTable(["Product", "Barcode", "Qty", "Min", "Category"], data.map((x) => [x.product_name, x.barcode, x.quantity, x.min_stock_level, x.category_name]));
    } else if (reportType === "stock-expiry") {
      renderTable(["Product", "Barcode", "Qty", "Expiry", "Days Left"], data.map((x) => [x.product_name, x.barcode, x.quantity, x.expiry_date, x.days_left]));
    } else {
      renderTable(["Product", "Avg/Day", "Lead", "Reorder", "Stock", "Suggest Qty"], data.map((x) => [x.product_name || x.product_id, x.average_daily_sales, x.lead_time_days, x.reorder_level, x.current_stock, x.suggested_purchase_qty]));
    }
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

document.getElementById("runBtn").addEventListener("click", runReport);
runReport();
