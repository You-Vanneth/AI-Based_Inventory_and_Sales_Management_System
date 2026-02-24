import { pool } from "../../db/pool.js";
import { sendMail } from "../../utils/mailer.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toFixed(2);
}

function formatDate(value) {
  if (!value) return "-";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function getSettings() {
  const [rows] = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_password_encrypted,
            sender_name, sender_email, use_tls,
            alert_expiry_days, alert_low_stock_enabled, alert_expiry_enabled
     FROM email_settings
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, email_setting_id DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

export async function getLowStockAlerts() {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.quantity,
            p.min_stock_level, p.cost_price, p.selling_price, c.category_name
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE p.deleted_at IS NULL
       AND p.quantity <= p.min_stock_level
     ORDER BY p.quantity ASC, p.product_id ASC`
  );

  return rows;
}

export async function getExpiringSoonAlerts() {
  const settings = await getSettings();
  const days = Number(settings?.alert_expiry_days || 7);

  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.quantity, p.cost_price, p.selling_price, p.expiry_date,
            DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
            c.category_name
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE p.deleted_at IS NULL
       AND p.expiry_date IS NOT NULL
       AND p.expiry_date >= CURDATE()
       AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY p.expiry_date ASC, p.product_id ASC`,
    [days]
  );

  return { days, items: rows };
}

export async function runAlertCheckAndSend() {
  const settings = await getSettings();
  const lowStock = await getLowStockAlerts();
  const expiring = await getExpiringSoonAlerts();

  const alertLowStockEnabled = Number(settings?.alert_low_stock_enabled ?? 1) === 1;
  const alertExpiryEnabled = Number(settings?.alert_expiry_enabled ?? 1) === 1;

  if (!settings && !process.env.RESEND_API_KEY) {
    return {
      email_sent: false,
      reason: "Email settings not configured",
      low_stock: lowStock,
      expiring_soon: expiring.items
    };
  }

  const shouldSend =
    (alertLowStockEnabled && lowStock.length > 0) ||
    (alertExpiryEnabled && expiring.items.length > 0);

  if (!shouldSend) {
    return {
      email_sent: false,
      reason: "No alert items or alert type disabled",
      low_stock: lowStock,
      expiring_soon: expiring.items
    };
  }

  const receiver = settings?.sender_email || process.env.ALERT_TO_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!receiver) {
    return {
      email_sent: false,
      reason: "Alert receiver email not configured",
      low_stock: lowStock,
      expiring_soon: expiring.items
    };
  }

  const lowStockHtml = lowStock
    .map((x) => `
      <tr>
        <td>${escapeHtml(x.product_name)}</td>
        <td>${escapeHtml(x.barcode)}</td>
        <td>${escapeHtml(x.category_name)}</td>
        <td>${x.quantity}</td>
        <td>${x.min_stock_level}</td>
        <td>${formatMoney(x.cost_price)}</td>
        <td>${formatMoney(x.selling_price)}</td>
      </tr>
    `)
    .join("");

  const expiringHtml = expiring.items
    .map((x) => `
      <tr>
        <td>${escapeHtml(x.product_name)}</td>
        <td>${escapeHtml(x.barcode)}</td>
        <td>${escapeHtml(x.category_name)}</td>
        <td>${x.quantity}</td>
        <td>${formatDate(x.expiry_date)}</td>
        <td>${x.days_left}</td>
        <td>${formatMoney(x.cost_price)}</td>
        <td>${formatMoney(x.selling_price)}</td>
      </tr>
    `)
    .join("");

  let info;
  try {
    info = await sendMail({
      settings,
      to: receiver,
      subject: "AI Inventory Alerts",
      text: `Low stock count: ${lowStock.length}; Expiring soon count: ${expiring.items.length}`,
      html: `
        <div style="font-family: Arial, sans-serif; color:#111827">
          <h2 style="margin-bottom: 4px;">AI Inventory Alerts</h2>
          <p style="margin-top: 0; color:#6b7280">Generated at ${new Date().toISOString()}</p>

          <h3 style="margin-top: 24px;">Low Stock (${lowStock.length})</h3>
          ${
            lowStock.length > 0
              ? `
                <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-size: 13px;">
                  <thead style="background:#f3f4f6">
                    <tr>
                      <th align="left">Product</th>
                      <th align="left">Barcode</th>
                      <th align="left">Category</th>
                      <th align="right">Qty</th>
                      <th align="right">Min</th>
                      <th align="right">Cost</th>
                      <th align="right">Selling</th>
                    </tr>
                  </thead>
                  <tbody>${lowStockHtml}</tbody>
                </table>
              `
              : "<p>No low stock items.</p>"
          }

          <h3 style="margin-top: 24px;">Expiring Soon (within ${expiring.days} days) (${expiring.items.length})</h3>
          ${
            expiring.items.length > 0
              ? `
                <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-size: 13px;">
                  <thead style="background:#f3f4f6">
                    <tr>
                      <th align="left">Product</th>
                      <th align="left">Barcode</th>
                      <th align="left">Category</th>
                      <th align="right">Qty</th>
                      <th align="left">Expiry</th>
                      <th align="right">Days Left</th>
                      <th align="right">Cost</th>
                      <th align="right">Selling</th>
                    </tr>
                  </thead>
                  <tbody>${expiringHtml}</tbody>
                </table>
              `
              : "<p>No expiring items in the configured window.</p>"
          }
        </div>
      `
    });
  } catch (error) {
    return {
      email_sent: false,
      reason: error?.message || "Failed to send alert email",
      low_stock: lowStock,
      expiring_soon: expiring.items
    };
  }

  return {
    email_sent: true,
    provider: info.provider,
    message_id: info.message_id,
    low_stock_count: lowStock.length,
    expiring_soon_count: expiring.items.length
  };
}
