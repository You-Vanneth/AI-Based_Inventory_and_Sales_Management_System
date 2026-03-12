import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { dbQuery, getMysqlPool, isMysqlEnabled } from "./config/db.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createAuthRequired } from "./middlewares/auth.middleware.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import {
  buildPdfDocument,
  buildXlsxDocument,
  clamp,
  csvEscape,
  daysUntil,
  nowIso,
  startOfDay,
  toNumber
} from "./utils/helpers.js";

const app = express();
const PORT = Number(process.env.PORT || 5001);
const FRONTEND_URL = String(process.env.FRONTEND_URL || "").trim();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

function asBool(value) {
  return Number(value || 0) === 1 || value === true;
}

function getBackendBaseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || `127.0.0.1:${PORT}`;
  return `${protocol}://${host}`;
}

async function getBackendStatusSummary(req) {
  const summary = {
    backend_url: getBackendBaseUrl(req),
    frontend_url: FRONTEND_URL || "",
    api_prefix: "/api/v1",
    environment: process.env.NODE_ENV || "development",
    time: nowIso(),
    mysql: {
      enabled: isMysqlEnabled(),
      connected: false,
      label: "Not configured"
    }
  };

  if (!isMysqlEnabled()) return summary;

  try {
    const pool = getMysqlPool();
    await pool.query("SELECT 1 AS ok");
    summary.mysql.connected = true;
    summary.mysql.label = `Connected to ${process.env.MYSQL_DATABASE || "ai_inventory"}`;
  } catch (err) {
    summary.mysql.connected = false;
    summary.mysql.label = `Connection failed: ${err.message}`;
  }

  return summary;
}

function renderBackendPage(summary) {
  const dbTone = summary.mysql.connected ? "#166534" : "#991b1b";
  const dbBg = summary.mysql.connected ? "#dcfce7" : "#fee2e2";
  const dbBorder = summary.mysql.connected ? "#86efac" : "#fca5a5";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Inventory Backend</title>
    <style>
      :root {
        --bg: #eef4f8;
        --ink: #0f172a;
        --muted: #475569;
        --line: #dbe5f0;
        --panel: #ffffff;
        --primary: #0f766e;
        --primary-strong: #0e7490;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at 12% 12%, #d7eefc 0%, transparent 24%),
          radial-gradient(circle at 88% 82%, #d2f5e8 0%, transparent 26%),
          linear-gradient(135deg, #f8fbfd 0%, var(--bg) 100%);
        color: var(--ink);
      }
      main {
        max-width: 980px;
        margin: 42px auto;
        padding: 0 20px;
      }
      .hero {
        background: linear-gradient(135deg, #082f49, #0f766e);
        color: #effcff;
        border-radius: 22px;
        padding: 28px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
      }
      .hero p { color: #d7f4ff; margin: 10px 0 0; line-height: 1.5; }
      h1 { margin: 0; font-size: 40px; line-height: 1.05; }
      h2 { margin: 0 0 14px; font-size: 22px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
      }
      .kpi {
        display: grid;
        gap: 6px;
      }
      .label {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: .08em;
      }
      .value {
        font-size: 24px;
        font-weight: 700;
      }
      .muted { color: var(--muted); }
      .pill, code {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: #e2e8f0;
        color: var(--ink);
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-weight: 600;
        border: 1px solid ${dbBorder};
        background: ${dbBg};
        color: ${dbTone};
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      a {
        color: var(--primary-strong);
        text-decoration: none;
        font-weight: 600;
      }
      ul {
        margin: 0;
        padding-left: 18px;
        color: #334155;
      }
      li + li { margin-top: 8px; }
      @media (max-width: 640px) {
        h1 { font-size: 30px; }
        main { margin: 24px auto; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>AI Inventory Backend</h1>
        <p>Backend is running successfully and ready to serve frontend API requests.</p>
      </section>
      <section class="grid">
        <article class="card kpi">
          <div class="label">Backend URL</div>
          <div class="value"><a href="${summary.backend_url}">${summary.backend_url}</a></div>
        </article>
        <article class="card kpi">
          <div class="label">Frontend URL</div>
          <div class="value">0</div>
        </article>
        <article class="card kpi">
          <div class="label">API Prefix</div>
          <div class="value"><code>${summary.api_prefix}</code></div>
        </article>
        <article class="card kpi">
          <div class="label">Environment</div>
          <div class="value">${summary.environment}</div>
        </article>
      </section>
      <section class="grid">
        <article class="card">
          <h2>Service Status</h2>
          <div class="status">${summary.mysql.label}</div>
          <p class="muted" style="margin-top: 12px;">Server time: ${summary.time}</p>
        </article>
        <article class="card">
          <h2>Useful Routes</h2>
          <ul>
            <li><a href="/api/v1/health">/api/v1/health</a></li>
            <li><a href="/api/v1/products">/api/v1/products</a> <span class="muted">(auth required)</span></li>
            <li><a href="/api/v1/dashboard/summary?period=7d">/api/v1/dashboard/summary?period=7d</a> <span class="muted">(auth required)</span></li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

// ===== in-memory data =====
let userIdSeq = 2;
let productIdSeq = 4;
let categoryIdSeq = 2;
let movementIdSeq = 1;
let saleIdSeq = 1000;
let forecastVersionSeq = 2;
let notificationIdSeq = 3;
let sessionIdSeq = 3;
let reportRunIdSeq = 1;

const users = [
  {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    password: "123456",
    full_name: "Demo Admin",
    role: "ADMINISTRATOR",
    role_name: "ADMINISTRATOR",
    status: "ACTIVE",
    locked: false,
    force_reset: false,
    created_by: "System",
    created_at: "2026-02-01T08:00:00.000Z",
    updated_by: "System",
    updated_at: "2026-03-01T09:10:00.000Z",
    last_login: nowIso()
  },
  {
    id: 2,
    username: "cashier1",
    email: "cashier@example.com",
    password: "123456",
    full_name: "Demo Cashier",
    role: "CASHIER",
    role_name: "CASHIER",
    status: "ACTIVE",
    locked: false,
    force_reset: false,
    created_by: "Demo Admin",
    created_at: "2026-02-03T10:15:00.000Z",
    updated_by: "Manager A",
    updated_at: "2026-03-04T16:05:00.000Z",
    last_login: nowIso()
  }
];

const roleTemplates = {
  ADMINISTRATOR: [
    "dashboard.view",
    "products.manage",
    "sales.manage",
    "reports.view",
    "ai.manage",
    "inventory.manage",
    "categories.manage",
    "users.manage",
    "email.manage"
  ],
  CASHIER: ["dashboard.view", "products.view", "sales.create", "sales.refund", "reports.view"]
};

const userPermissions = {
  1: [...roleTemplates.ADMINISTRATOR],
  2: [...roleTemplates.CASHIER]
};

const sessions = [
  { id: 1, user_id: 1, device: "MacBook Pro", ip: "103.1.2.3", started_at: nowIso(), active: true },
  { id: 2, user_id: 2, device: "Windows POS", ip: "10.0.0.12", started_at: nowIso(), active: true }
];

const userActivity = [];
const authTokens = new Map([["demo-token", 1]]); // token -> userId

const categories = [
  {
    id: 1,
    name_en: "Drink",
    name_km: "ភេសជ្ជៈ",
    description: "Beverages and bottled items",
    status: "ACTIVE",
    product_count: 2,
    icon_url: "",
    created_by: "Demo Admin",
    created_at: "2026-02-01T09:14:00.000Z",
    updated_by: "Demo Admin",
    updated_at: "2026-03-01T15:02:00.000Z"
  },
  {
    id: 2,
    name_en: "Food",
    name_km: "អាហារ",
    description: "General food products",
    status: "ACTIVE",
    product_count: 2,
    icon_url: "",
    created_by: "Demo Admin",
    created_at: "2026-02-02T10:44:00.000Z",
    updated_by: "Manager A",
    updated_at: "2026-03-04T11:18:00.000Z"
  }
];

const products = [
  {
    id: 1,
    product_name: "Coca Cola 330ml",
    barcode: "8850001",
    category_name: "Drink",
    quantity: 14,
    cost_price: 0.55,
    selling_price: 0.75,
    min_stock_level: 10,
    supplier: "Coca Distributor",
    expiry_date: "2026-03-30",
    image_url: "",
    status: "ACTIVE",
    monthly_sales: 84,
    store: "MAIN",
    created_at: "2026-03-01T09:00:00.000Z",
    updated_at: "2026-03-01T09:00:00.000Z"
  },
  {
    id: 2,
    product_name: "Instant Noodle",
    barcode: "8850002",
    category_name: "Food",
    quantity: 5,
    cost_price: 0.3,
    selling_price: 0.45,
    min_stock_level: 12,
    supplier: "Noodle Trading",
    expiry_date: "2026-08-15",
    image_url: "",
    status: "ACTIVE",
    monthly_sales: 96,
    store: "MAIN",
    created_at: "2026-03-01T09:00:00.000Z",
    updated_at: "2026-03-01T09:00:00.000Z"
  },
  {
    id: 3,
    product_name: "UHT Milk",
    barcode: "8850003",
    category_name: "Food",
    quantity: 8,
    cost_price: 0.95,
    selling_price: 1.2,
    min_stock_level: 10,
    supplier: "Dairy KH",
    expiry_date: "2026-03-12",
    image_url: "",
    status: "ACTIVE",
    monthly_sales: 41,
    store: "MAIN",
    created_at: "2026-03-01T09:00:00.000Z",
    updated_at: "2026-03-01T09:00:00.000Z"
  },
  {
    id: 4,
    product_name: "Hand Soap",
    barcode: "8850011",
    category_name: "Food",
    quantity: 2,
    cost_price: 0.9,
    selling_price: 1.4,
    min_stock_level: 8,
    supplier: "Clean Plus",
    expiry_date: "",
    image_url: "",
    status: "ACTIVE",
    monthly_sales: 18,
    store: "MAIN",
    created_at: "2026-03-01T09:00:00.000Z",
    updated_at: "2026-03-01T09:00:00.000Z"
  }
];

const stockLots = [
  { id: 1, product_id: 3, product_name: "UHT Milk", barcode: "8850003", lot: "MILK-A12", qty: 4, expiry: "2026-03-10", supplier: "Dairy KH", store: "MAIN" },
  { id: 2, product_id: 3, product_name: "UHT Milk", barcode: "8850003", lot: "MILK-B07", qty: 4, expiry: "2026-03-18", supplier: "Dairy KH", store: "MAIN" },
  { id: 3, product_id: 2, product_name: "Instant Noodle", barcode: "8850002", lot: "NDL-C33", qty: 5, expiry: "2026-08-15", supplier: "Noodle Trading", store: "MAIN" }
];

const stockMovements = [];

const sales = [];
const shiftClosures = [];

const emailSettings = {
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  sender_name: "AI Inventory",
  sender_email: "",
  use_tls: 1,
  alert_expiry_days: 7,
  alert_low_stock_enabled: 1,
  alert_expiry_enabled: 1,
  alert_recipients: [""]
};

const notifications = [
  {
    id: 1,
    time: "2026-03-05 09:12",
    type: "LOW_STOCK",
    priority: "HIGH",
    product: "Instant Noodle",
    message: "Stock is below minimum threshold (5/12).",
    channel: "IN_APP + EMAIL",
    delivery_status: "SENT",
    read: false,
    acknowledged: false,
    snoozed_until: "-",
    source_link: "/inventory-health",
    read_by: "-",
    read_at: "-"
  },
  {
    id: 2,
    time: "2026-03-05 08:40",
    type: "EXPIRY_7D",
    priority: "HIGH",
    product: "UHT Milk",
    message: "Product expires within 7 days.",
    channel: "IN_APP + EMAIL",
    delivery_status: "FAILED",
    read: false,
    acknowledged: false,
    snoozed_until: "-",
    source_link: "/inventory-health",
    read_by: "-",
    read_at: "-"
  },
  {
    id: 3,
    time: "2026-03-04 17:25",
    type: "REORDER_AI",
    priority: "MEDIUM",
    product: "Coca Cola 330ml",
    message: "AI recommends reorder quantity +26.",
    channel: "IN_APP",
    delivery_status: "SENT",
    read: true,
    acknowledged: true,
    snoozed_until: "-",
    source_link: "/ai",
    read_by: "Demo Admin",
    read_at: "2026-03-04 17:30"
  }
];

const notificationPreferences = {
  role: "ADMIN",
  channel_in_app: true,
  channel_email: true,
  low_stock_threshold: 12,
  expiry_window_days: 7,
  dedup_minutes: 30,
  suppression_enabled: true
};

const notificationRules = [
  { id: 1, rule: "LOW_STOCK", severity: "HIGH", channel: "IN_APP + EMAIL", active: true },
  { id: 2, rule: "CRITICAL_STOCK", severity: "CRITICAL", channel: "IN_APP + EMAIL", active: true },
  { id: 3, rule: "EXPIRY_30D", severity: "MEDIUM", channel: "IN_APP", active: true },
  { id: 4, rule: "EXPIRY_7D", severity: "HIGH", channel: "IN_APP + EMAIL", active: true },
  { id: 5, rule: "REORDER_AI", severity: "MEDIUM", channel: "IN_APP", active: true }
];

const reportRuns = [];

const aiModelPerformance = [
  { category: "Beverages", prophet_mape: 12.8, arima_mape: 14.5, prophet_mae: 3.1, arima_mae: 3.7, prophet_rmse: 4.8, arima_rmse: 5.2, selected: "PROPHET" },
  { category: "Snacks", prophet_mape: 15.2, arima_mape: 13.9, prophet_mae: 3.8, arima_mae: 3.5, prophet_rmse: 5.6, arima_rmse: 5.0, selected: "ARIMA" },
  { category: "Rice & Grains", prophet_mape: 10.5, arima_mape: 11.2, prophet_mae: 2.5, arima_mae: 2.8, prophet_rmse: 3.9, arima_rmse: 4.2, selected: "PROPHET" }
];

const aiForecastVersions = [
  { id: 1, version: "FCAST-2026-03-01-01", product: 1, model: "PROPHET", generated_at: "2026-03-01 09:00", horizon: 30, mape: 13.4 },
  { id: 2, version: "FCAST-2026-02-24-03", product: 1, model: "ARIMA", generated_at: "2026-02-24 09:00", horizon: 30, mape: 14.1 }
];

const aiForecastHistory = [];
const authRequired = createAuthRequired({ authTokens, users });
const authController = createAuthController({
  authTokens,
  users,
  sessions,
  appendUserActivity,
  nextSessionId: () => sessionIdSeq++
});

app.use("/api/v1", createAuthRouter({ authController, authRequired }));

function appendUserActivity(action, detail) {
  userActivity.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    time: nowIso(),
    action,
    detail
  });
}

function notifyFromInventory(product, type, message) {
  notifications.unshift({
    id: ++notificationIdSeq,
    time: new Date().toLocaleString(),
    type,
    priority: type === "LOW_STOCK" ? "HIGH" : "MEDIUM",
    product: product.product_name,
    message,
    channel: "IN_APP + EMAIL",
    delivery_status: "SENT",
    read: false,
    acknowledged: false,
    snoozed_until: "-",
    source_link: "/inventory-health",
    read_by: "-",
    read_at: "-"
  });
}

function dashboardSummary() {
  const today = startOfDay();
  const todaySales = sales.filter((s) => !s.is_refund && parseDate(s.sale_time) >= today);
  const totalSalesToday = todaySales.length;
  const txToday = todaySales.length;
  const monthlySales = sales.filter((s) => !s.is_refund);
  const monthlyRevenue = monthlySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const cogsMonthly = monthlySales.reduce((sum, s) => {
    const itemCost = (s.items || []).reduce((acc, i) => acc + Number(i.qty || 0) * Number(i.cost_price || 0), 0);
    return sum + itemCost;
  }, 0);
  const grossProfit = monthlyRevenue - cogsMonthly;
  const margin = monthlyRevenue ? (grossProfit / monthlyRevenue) * 100 : 0;
  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity < p.min_stock_level).length;
  const outStockCount = products.filter((p) => p.quantity <= 0).length;

  const salesByDay = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    const dayAmount = sales
      .filter((s) => !s.is_refund && String(s.sale_time).slice(0, 10) === key)
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      amount: Number(dayAmount.toFixed(2))
    };
  });

  const topProducts = products
    .map((p) => ({
      product_name: p.product_name,
      sold_qty: p.monthly_sales,
      revenue: Number((p.monthly_sales * p.selling_price).toFixed(2))
    }))
    .sort((a, b) => b.sold_qty - a.sold_qty)
    .slice(0, 4);

  const expiringSoon = products.filter((p) => {
    if (!p.expiry_date) return false;
    const d = daysUntil(p.expiry_date);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  const paymentMap = new Map();
  monthlySales.forEach((s) => {
    const current = paymentMap.get(s.payment_method) || 0;
    paymentMap.set(s.payment_method, current + Number(s.total || 0));
  });
  const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, amount]) => ({
    method,
    amount: Number(amount.toFixed(2))
  }));
  if (!paymentBreakdown.length) {
    paymentBreakdown.push({ method: "CASH", amount: 1885.8 }, { method: "BANK_TRANSFER", amount: 974.55 });
  }

  const stockDistribution = { adequate: 0, low: 0, critical: 0, out: 0 };
  products.forEach((p) => {
    if (p.quantity <= 0) stockDistribution.out += 1;
    else if (p.quantity <= Math.ceil(p.min_stock_level * 0.5)) stockDistribution.critical += 1;
    else if (p.quantity < p.min_stock_level) stockDistribution.low += 1;
    else stockDistribution.adequate += 1;
  });

  const invValue = products.reduce((sum, p) => sum + p.quantity * p.cost_price, 0) || 1;
  const turnover = Number((cogsMonthly / invValue).toFixed(2));
  const deadStock = products.filter((p) => p.monthly_sales <= 2).length;

  const stockAlerts = products
    .filter((p) => p.quantity < p.min_stock_level || p.quantity <= 0)
    .slice(0, 5)
    .map((p) => ({
      product_name: p.product_name,
      qty: p.quantity,
      min_stock: p.min_stock_level,
      type: p.quantity <= 0 ? "OUT" : "LOW"
    }));

  return {
    total_products: products.length,
    transactions_today: txToday,
    total_sales_today: totalSalesToday,
    monthly_revenue: Number(monthlyRevenue.toFixed(2)),
    cogs_monthly: Number(cogsMonthly.toFixed(2)),
    gross_profit_monthly: Number(grossProfit.toFixed(2)),
    profit_margin_pct: Number(margin.toFixed(2)),
    low_stock_count: lowStockCount + outStockCount,
    expiring_soon_count: expiringSoon,
    inventory_turnover_ratio: turnover,
    dead_stock_count: deadStock,
    stock_distribution: stockDistribution,
    payment_breakdown: paymentBreakdown,
    sales_7d: salesByDay,
    top_products: topProducts,
    stock_alerts: stockAlerts
  };
}

async function dashboardSummaryFromDb() {
  const [productCountRow] = await dbQuery("SELECT COUNT(*) AS c FROM products");
  const [todayTxnRow] = await dbQuery(
    "SELECT COUNT(*) AS tx FROM sales WHERE is_refund = 0 AND DATE(sale_time) = CURDATE()"
  );
  const [monthlyRevenueRow] = await dbQuery(
    "SELECT COALESCE(SUM(total), 0) AS revenue FROM sales WHERE is_refund = 0 AND YEAR(sale_time) = YEAR(CURDATE()) AND MONTH(sale_time) = MONTH(CURDATE())"
  );
  const [cogsRow] = await dbQuery(
    `SELECT COALESCE(SUM(si.qty * si.cost_price), 0) AS cogs
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.is_refund = 0
       AND YEAR(s.sale_time) = YEAR(CURDATE())
       AND MONTH(s.sale_time) = MONTH(CURDATE())`
  );
  const [stockCounts] = await dbQuery(
    `SELECT
      SUM(CASE WHEN quantity > 0 AND quantity < min_stock_level THEN 1 ELSE 0 END) AS low_stock,
      SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_stock,
      SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_count,
      SUM(CASE WHEN quantity > 0 AND quantity <= CEIL(min_stock_level * 0.5) THEN 1 ELSE 0 END) AS critical_count,
      SUM(CASE WHEN quantity > CEIL(min_stock_level * 0.5) AND quantity < min_stock_level THEN 1 ELSE 0 END) AS low_count,
      SUM(CASE WHEN quantity >= min_stock_level THEN 1 ELSE 0 END) AS adequate_count
     FROM products`
  );
  const [expiringSoonRow] = await dbQuery(
    "SELECT COUNT(*) AS c FROM products WHERE expiry_date IS NOT NULL AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
  );
  const [invValueRow] = await dbQuery("SELECT COALESCE(SUM(quantity * cost_price), 0) AS v FROM products");
  const [deadStockRow] = await dbQuery("SELECT COUNT(*) AS c FROM products WHERE monthly_sales <= 2");
  const paymentRows = await dbQuery(
    "SELECT payment_method AS method, COALESCE(SUM(total), 0) AS amount FROM sales WHERE is_refund = 0 GROUP BY payment_method"
  );
  const salesRows = await dbQuery(
    "SELECT DATE(sale_time) AS d, COALESCE(SUM(total), 0) AS amount FROM sales WHERE is_refund = 0 AND sale_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(sale_time)"
  );
  const topRows = await dbQuery(
    "SELECT product_name, monthly_sales AS sold_qty, ROUND(monthly_sales * selling_price, 2) AS revenue FROM products ORDER BY monthly_sales DESC LIMIT 4"
  );
  const stockAlertRows = await dbQuery(
    "SELECT product_name, quantity AS qty, min_stock_level AS min_stock, CASE WHEN quantity <= 0 THEN 'OUT' ELSE 'LOW' END AS type FROM products WHERE quantity < min_stock_level OR quantity <= 0 ORDER BY quantity ASC LIMIT 5"
  );

  const monthlyRevenue = Number(monthlyRevenueRow?.revenue || 0);
  const cogsMonthly = Number(cogsRow?.cogs || 0);
  const grossProfit = monthlyRevenue - cogsMonthly;
  const profitMargin = monthlyRevenue ? (grossProfit / monthlyRevenue) * 100 : 0;
  const invValue = Number(invValueRow?.v || 0) || 1;
  const turnover = cogsMonthly / invValue;

  const salesMap = new Map(
    salesRows.map((r) => [new Date(r.d).toISOString().slice(0, 10), Number(r.amount || 0)])
  );
  const today = startOfDay();
  const sales7d = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      amount: Number((salesMap.get(key) || 0).toFixed(2))
    };
  });

  const paymentBreakdown = paymentRows.map((r) => ({
    method: r.method,
    amount: Number(Number(r.amount || 0).toFixed(2))
  }));
  if (!paymentBreakdown.length) {
    paymentBreakdown.push({ method: "CASH", amount: 1885.8 }, { method: "BANK_TRANSFER", amount: 974.55 });
  }

  return {
    total_products: Number(productCountRow?.c || 0),
    transactions_today: Number(todayTxnRow?.tx || 0),
    total_sales_today: Number(todayTxnRow?.tx || 0),
    monthly_revenue: Number(monthlyRevenue.toFixed(2)),
    cogs_monthly: Number(cogsMonthly.toFixed(2)),
    gross_profit_monthly: Number(grossProfit.toFixed(2)),
    profit_margin_pct: Number(profitMargin.toFixed(2)),
    low_stock_count: Number(stockCounts?.low_stock || 0) + Number(stockCounts?.out_stock || 0),
    expiring_soon_count: Number(expiringSoonRow?.c || 0),
    inventory_turnover_ratio: Number(turnover.toFixed(2)),
    dead_stock_count: Number(deadStockRow?.c || 0),
    stock_distribution: {
      adequate: Number(stockCounts?.adequate_count || 0),
      low: Number(stockCounts?.low_count || 0),
      critical: Number(stockCounts?.critical_count || 0),
      out: Number(stockCounts?.out_count || 0)
    },
    payment_breakdown: paymentBreakdown,
    sales_7d: sales7d,
    top_products: topRows.map((r) => ({
      product_name: r.product_name,
      sold_qty: Number(r.sold_qty || 0),
      revenue: Number(Number(r.revenue || 0).toFixed(2))
    })),
    stock_alerts: stockAlertRows.map((r) => ({
      product_name: r.product_name,
      qty: Number(r.qty || 0),
      min_stock: Number(r.min_stock || 0),
      type: r.type
    }))
  };
}

// ===== dashboard =====
app.get("/api/v1/dashboard/summary", authRequired, async (req, res) => {
  const period = String(req.query.period || "7d");
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  let summary = dashboardSummary();
  if (isMysqlEnabled()) {
    try {
      summary = await dashboardSummaryFromDb();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("mysql dashboard failed, fallback in-memory:", err.message);
    }
  }
  res.json({
    data: {
      ...summary,
      meta: {
        period,
        from: from || null,
        to: to || null,
        generated_at: nowIso()
      }
    }
  });
});

// ===== categories =====
app.get("/api/v1/categories", authRequired, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const status = String(req.query.status || "ALL");
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT c.id, c.name_en, c.name_km, c.description, c.status, c.icon_url, c.created_by, c.created_at, c.updated_by, c.updated_at,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE (? = '' OR LOWER(c.name_en) LIKE ? OR LOWER(c.name_km) LIKE ? OR LOWER(c.description) LIKE ?)
         AND (? = 'ALL' OR c.status = ?)
       GROUP BY c.id
       ORDER BY c.id DESC`,
      [q, `%${q}%`, `%${q}%`, `%${q}%`, status, status]
    );
    return res.json({ data: rows.map((r) => ({ ...r, product_count: Number(r.product_count || 0) })) });
  }
  let rows = [...categories];
  if (q) {
    rows = rows.filter(
      (c) =>
        c.name_en.toLowerCase().includes(q) ||
        c.name_km.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }
  if (status !== "ALL") rows = rows.filter((c) => c.status === status);
  res.json({ data: rows });
});

app.post("/api/v1/categories", authRequired, async (req, res) => {
  const body = req.body || {};
  const name_en = String(body.name_en || "").trim();
  const name_km = String(body.name_km || "").trim();
  if (!name_en || !name_km) return res.status(400).json({ message: "name_en and name_km are required" });
  if (isMysqlEnabled()) {
    const dup = await dbQuery(
      "SELECT id FROM categories WHERE LOWER(name_en) = LOWER(?) OR name_km = ? LIMIT 1",
      [name_en, name_km]
    );
    if (dup[0]) return res.status(400).json({ message: "Category already exists" });
    const result = await dbQuery(
      `INSERT INTO categories (name_en, name_km, description, status, icon_url, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name_en,
        name_km,
        String(body.description || ""),
        String(body.status || "ACTIVE"),
        String(body.icon_url || ""),
        req.user.full_name,
        req.user.full_name
      ]
    );
    const row = (await dbQuery("SELECT *, 0 AS product_count FROM categories WHERE id = ?", [result.insertId]))[0];
    return res.status(201).json({ data: row });
  }
  const duplicate = categories.find(
    (c) => c.name_en.toLowerCase() === name_en.toLowerCase() || c.name_km === name_km
  );
  if (duplicate) return res.status(400).json({ message: "Category already exists" });
  const now = nowIso();
  const item = {
    id: ++categoryIdSeq,
    name_en,
    name_km,
    description: String(body.description || ""),
    status: String(body.status || "ACTIVE"),
    product_count: 0,
    icon_url: String(body.icon_url || ""),
    created_by: req.user.full_name,
    created_at: now,
    updated_by: req.user.full_name,
    updated_at: now
  };
  categories.push(item);
  res.status(201).json({ data: item });
});

app.put("/api/v1/categories/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const exists = await dbQuery("SELECT id FROM categories WHERE id = ?", [id]);
    if (!exists[0]) return res.status(404).json({ message: "Category not found" });
    const body = req.body || {};
    await dbQuery(
      `UPDATE categories
       SET name_en = COALESCE(?, name_en),
           name_km = COALESCE(?, name_km),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           icon_url = COALESCE(?, icon_url),
           updated_by = ?
       WHERE id = ?`,
      [
        body.name_en ?? null,
        body.name_km ?? null,
        body.description ?? null,
        body.status ?? null,
        body.icon_url ?? null,
        req.user.full_name,
        id
      ]
    );
    const row = (await dbQuery("SELECT *, 0 AS product_count FROM categories WHERE id = ?", [id]))[0];
    return res.json({ data: row });
  }
  const idx = categories.findIndex((c) => c.id === id);
  if (idx < 0) return res.status(404).json({ message: "Category not found" });
  const body = req.body || {};
  const next = { ...categories[idx], ...body, updated_by: req.user.full_name, updated_at: nowIso() };
  categories[idx] = next;
  res.json({ data: next });
});

app.delete("/api/v1/categories/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      "SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c WHERE c.id = ?",
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Category not found" });
    if (Number(row.product_count || 0) > 0) {
      return res.status(400).json({ message: "Cannot delete category linked to products" });
    }
    await dbQuery("DELETE FROM categories WHERE id = ?", [id]);
    return res.json({ data: row });
  }
  const idx = categories.findIndex((c) => c.id === id);
  if (idx < 0) return res.status(404).json({ message: "Category not found" });
  if (categories[idx].product_count > 0) {
    return res.status(400).json({ message: "Cannot delete category linked to products" });
  }
  const [deleted] = categories.splice(idx, 1);
  res.json({ data: deleted });
});

// ===== products =====
app.get("/api/v1/products", authRequired, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const supplier = String(req.query.supplier || "ALL");
  const status = String(req.query.status || "ALL");
  const stock = String(req.query.stock || "ALL");
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT p.id, p.product_name, p.barcode, COALESCE(c.name_en, 'General') AS category_name,
              p.quantity, p.cost_price, p.selling_price, p.min_stock_level, p.supplier, p.expiry_date, p.image_url,
              p.status, p.monthly_sales, p.store_code AS store, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE (? = '' OR LOWER(p.product_name) LIKE ? OR LOWER(p.barcode) LIKE ? OR LOWER(COALESCE(c.name_en,'')) LIKE ?)
         AND (? = 'ALL' OR p.supplier = ?)
         AND (? = 'ALL' OR p.status = ?)
         AND (
           ? = 'ALL' OR
           (? = 'OUT' AND p.quantity <= 0) OR
           (? = 'LOW' AND p.quantity > 0 AND p.quantity < p.min_stock_level) OR
           (? = 'OK' AND p.quantity >= p.min_stock_level)
         )
       ORDER BY p.id DESC`,
      [q, `%${q}%`, `%${q}%`, `%${q}%`, supplier, supplier, status, status, stock, stock, stock, stock]
    );
    return res.json({ data: rows });
  }
  let rows = [...products];
  if (q) {
    rows = rows.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q)
    );
  }
  if (supplier !== "ALL") rows = rows.filter((p) => p.supplier === supplier);
  if (status !== "ALL") rows = rows.filter((p) => p.status === status);
  if (stock === "OUT") rows = rows.filter((p) => p.quantity <= 0);
  if (stock === "LOW") rows = rows.filter((p) => p.quantity > 0 && p.quantity < p.min_stock_level);
  if (stock === "OK") rows = rows.filter((p) => p.quantity >= p.min_stock_level);
  res.json({ data: rows });
});

app.get("/api/v1/products/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT p.id, p.product_name, p.barcode, COALESCE(c.name_en, 'General') AS category_name,
              p.quantity, p.cost_price, p.selling_price, p.min_stock_level, p.supplier, p.expiry_date, p.image_url,
              p.status, p.monthly_sales, p.store_code AS store, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    const item = rows[0];
    if (!item) return res.status(404).json({ message: "Product not found" });
    return res.json({ data: item });
  }
  const item = products.find((p) => p.id === id);
  if (!item) return res.status(404).json({ message: "Product not found" });
  res.json({ data: item });
});

app.post("/api/v1/products", authRequired, async (req, res) => {
  const body = req.body || {};
  const product_name = String(body.product_name || "").trim();
  const barcode = String(body.barcode || "").trim();
  if (!product_name || !barcode) return res.status(400).json({ message: "product_name and barcode are required" });
  if (isMysqlEnabled()) {
    const dup = await dbQuery("SELECT id FROM products WHERE barcode = ? LIMIT 1", [barcode]);
    if (dup[0]) return res.status(400).json({ message: "Barcode already exists" });
    let categoryId = null;
    if (body.category_name) {
      const cat = await dbQuery("SELECT id FROM categories WHERE name_en = ? LIMIT 1", [String(body.category_name)]);
      categoryId = cat[0]?.id || null;
    }
    const result = await dbQuery(
      `INSERT INTO products
        (product_name, barcode, category_id, quantity, cost_price, selling_price, min_stock_level, supplier, expiry_date, image_url, status, monthly_sales, store_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        product_name,
        barcode,
        categoryId,
        Math.max(0, toNumber(body.quantity, 0)),
        Math.max(0, toNumber(body.cost_price, 0)),
        Math.max(0, toNumber(body.selling_price, 0)),
        Math.max(0, toNumber(body.min_stock_level, 0)),
        String(body.supplier || ""),
        String(body.expiry_date || "") || null,
        String(body.image_url || ""),
        String(body.status || "ACTIVE"),
        String(body.store || "MAIN")
      ]
    );
    const rows = await dbQuery(
      `SELECT p.id, p.product_name, p.barcode, COALESCE(c.name_en, 'General') AS category_name,
              p.quantity, p.cost_price, p.selling_price, p.min_stock_level, p.supplier, p.expiry_date, p.image_url,
              p.status, p.monthly_sales, p.store_code AS store, p.created_at, p.updated_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ data: rows[0] });
  }
  if (products.some((p) => p.barcode === barcode)) return res.status(400).json({ message: "Barcode already exists" });
  const now = nowIso();
  const item = {
    id: ++productIdSeq,
    product_name,
    barcode,
    category_name: String(body.category_name || "General"),
    quantity: Math.max(0, toNumber(body.quantity, 0)),
    cost_price: Math.max(0, toNumber(body.cost_price, 0)),
    selling_price: Math.max(0, toNumber(body.selling_price, 0)),
    min_stock_level: Math.max(0, toNumber(body.min_stock_level, 0)),
    supplier: String(body.supplier || ""),
    expiry_date: String(body.expiry_date || ""),
    image_url: String(body.image_url || ""),
    status: String(body.status || "ACTIVE"),
    monthly_sales: 0,
    store: String(body.store || "MAIN"),
    created_at: now,
    updated_at: now
  };
  products.push(item);
  const cat = categories.find((c) => c.name_en === item.category_name);
  if (cat) cat.product_count += 1;
  res.status(201).json({ data: item });
});

app.put("/api/v1/products/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const existing = await dbQuery("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    if (!existing[0]) return res.status(404).json({ message: "Product not found" });
    const body = req.body || {};
    if (body.barcode) {
      const dup = await dbQuery("SELECT id FROM products WHERE barcode = ? AND id <> ? LIMIT 1", [String(body.barcode), id]);
      if (dup[0]) return res.status(400).json({ message: "Barcode already exists" });
    }
    let categoryId = existing[0].category_id;
    if (body.category_name !== undefined) {
      const cat = await dbQuery("SELECT id FROM categories WHERE name_en = ? LIMIT 1", [String(body.category_name || "")]);
      categoryId = cat[0]?.id || null;
    }
    await dbQuery(
      `UPDATE products
       SET product_name = COALESCE(?, product_name),
           barcode = COALESCE(?, barcode),
           category_id = ?,
           quantity = COALESCE(?, quantity),
           cost_price = COALESCE(?, cost_price),
           selling_price = COALESCE(?, selling_price),
           min_stock_level = COALESCE(?, min_stock_level),
           supplier = COALESCE(?, supplier),
           expiry_date = COALESCE(?, expiry_date),
           image_url = COALESCE(?, image_url),
           status = COALESCE(?, status),
           store_code = COALESCE(?, store_code)
       WHERE id = ?`,
      [
        body.product_name ?? null,
        body.barcode ?? null,
        categoryId,
        body.quantity !== undefined ? Math.max(0, toNumber(body.quantity, 0)) : null,
        body.cost_price !== undefined ? Math.max(0, toNumber(body.cost_price, 0)) : null,
        body.selling_price !== undefined ? Math.max(0, toNumber(body.selling_price, 0)) : null,
        body.min_stock_level !== undefined ? Math.max(0, toNumber(body.min_stock_level, 0)) : null,
        body.supplier ?? null,
        body.expiry_date ?? null,
        body.image_url ?? null,
        body.status ?? null,
        body.store ?? null,
        id
      ]
    );
    const rows = await dbQuery(
      `SELECT p.id, p.product_name, p.barcode, COALESCE(c.name_en, 'General') AS category_name,
              p.quantity, p.cost_price, p.selling_price, p.min_stock_level, p.supplier, p.expiry_date, p.image_url,
              p.status, p.monthly_sales, p.store_code AS store, p.created_at, p.updated_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [id]
    );
    return res.json({ data: rows[0] });
  }
  const idx = products.findIndex((p) => p.id === id);
  if (idx < 0) return res.status(404).json({ message: "Product not found" });
  const body = req.body || {};
  if (body.barcode) {
    const duplicate = products.find((p) => p.barcode === String(body.barcode) && p.id !== id);
    if (duplicate) return res.status(400).json({ message: "Barcode already exists" });
  }
  products[idx] = {
    ...products[idx],
    ...body,
    quantity: body.quantity !== undefined ? Math.max(0, toNumber(body.quantity, products[idx].quantity)) : products[idx].quantity,
    cost_price: body.cost_price !== undefined ? Math.max(0, toNumber(body.cost_price, products[idx].cost_price)) : products[idx].cost_price,
    selling_price: body.selling_price !== undefined ? Math.max(0, toNumber(body.selling_price, products[idx].selling_price)) : products[idx].selling_price,
    min_stock_level: body.min_stock_level !== undefined ? Math.max(0, toNumber(body.min_stock_level, products[idx].min_stock_level)) : products[idx].min_stock_level,
    updated_at: nowIso()
  };
  res.json({ data: products[idx] });
});

app.delete("/api/v1/products/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    if (!rows[0]) return res.status(404).json({ message: "Product not found" });
    await dbQuery("DELETE FROM products WHERE id = ?", [id]);
    return res.json({ data: rows[0] });
  }
  const idx = products.findIndex((p) => p.id === id);
  if (idx < 0) return res.status(404).json({ message: "Product not found" });
  const [deleted] = products.splice(idx, 1);
  res.json({ data: deleted });
});

app.post("/api/v1/products/import", authRequired, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (isMysqlEnabled()) {
    const inserted = [];
    for (const r of rows) {
      const product_name = String(r.product_name || "").trim();
      const barcode = String(r.barcode || "").trim();
      if (!product_name || !barcode) continue;
      const dup = await dbQuery("SELECT id FROM products WHERE barcode = ? LIMIT 1", [barcode]);
      if (dup[0]) continue;
      let categoryId = null;
      if (r.category_name) {
        const cat = await dbQuery("SELECT id FROM categories WHERE name_en = ? LIMIT 1", [String(r.category_name)]);
        categoryId = cat[0]?.id || null;
      }
      const result = await dbQuery(
        `INSERT INTO products
          (product_name, barcode, category_id, quantity, cost_price, selling_price, min_stock_level, supplier, expiry_date, image_url, status, monthly_sales, store_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          product_name,
          barcode,
          categoryId,
          Math.max(0, toNumber(r.quantity, 0)),
          Math.max(0, toNumber(r.cost_price, 0)),
          Math.max(0, toNumber(r.selling_price, 0)),
          Math.max(0, toNumber(r.min_stock_level, 0)),
          String(r.supplier || ""),
          String(r.expiry_date || "") || null,
          String(r.image_url || ""),
          String(r.status || "ACTIVE"),
          String(r.store || "MAIN")
        ]
      );
      inserted.push({ id: result.insertId, product_name, barcode });
    }
    return res.status(201).json({ data: { inserted_count: inserted.length, inserted } });
  }
  const inserted = [];
  rows.forEach((r) => {
    const product_name = String(r.product_name || "").trim();
    const barcode = String(r.barcode || "").trim();
    if (!product_name || !barcode) return;
    if (products.some((p) => p.barcode === barcode)) return;
    inserted.push({
      id: ++productIdSeq,
      product_name,
      barcode,
      category_name: String(r.category_name || "General"),
      quantity: Math.max(0, toNumber(r.quantity, 0)),
      cost_price: Math.max(0, toNumber(r.cost_price, 0)),
      selling_price: Math.max(0, toNumber(r.selling_price, 0)),
      min_stock_level: Math.max(0, toNumber(r.min_stock_level, 0)),
      supplier: String(r.supplier || ""),
      expiry_date: String(r.expiry_date || ""),
      image_url: String(r.image_url || ""),
      status: String(r.status || "ACTIVE"),
      monthly_sales: 0,
      store: String(r.store || "MAIN"),
      created_at: nowIso(),
      updated_at: nowIso()
    });
  });
  products.push(...inserted);
  res.status(201).json({ data: { inserted_count: inserted.length, inserted } });
});

// ===== inventory =====
app.get("/api/v1/inventory/summary", authRequired, async (req, res) => {
  const store = String(req.query.store || "MAIN");
  const windowDays = toNumber(req.query.window_days, 30);
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT
        SUM(CASE WHEN quantity < min_stock_level THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_stock_count,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS expiring_soon_count,
        SUM(CASE WHEN monthly_sales <= 2 THEN 1 ELSE 0 END) AS dead_stock_count,
        COALESCE(SUM(monthly_sales * cost_price),0) AS cogs,
        COALESCE(SUM(quantity * cost_price),0) AS inv
       FROM products WHERE store_code = ?`,
      [windowDays, store]
    );
    const r = rows[0] || {};
    const inv = Number(r.inv || 0) || 1;
    return res.json({
      data: {
        low_stock_count: Number(r.low_stock_count || 0),
        out_stock_count: Number(r.out_stock_count || 0),
        expiring_soon_count: Number(r.expiring_soon_count || 0),
        inventory_turnover_ratio: Number((Number(r.cogs || 0) / inv).toFixed(2)),
        dead_stock_count: Number(r.dead_stock_count || 0)
      }
    });
  }
  const rows = products.filter((p) => p.store === store);
  const low = rows.filter((x) => x.quantity < x.min_stock_level).length;
  const out = rows.filter((x) => x.quantity <= 0).length;
  const expiringSoon = rows.filter((x) => {
    if (!x.expiry_date) return false;
    const d = daysUntil(x.expiry_date);
    return d !== null && d >= 0 && d <= windowDays;
  }).length;
  const cogs = rows.reduce((sum, x) => sum + Number(x.monthly_sales || 0) * Number(x.cost_price || 0), 0);
  const inv = rows.reduce((sum, x) => sum + Number(x.quantity || 0) * Number(x.cost_price || 0), 0) || 1;
  res.json({
    data: {
      low_stock_count: low,
      out_stock_count: out,
      expiring_soon_count: expiringSoon,
      inventory_turnover_ratio: Number((cogs / inv).toFixed(2)),
      dead_stock_count: rows.filter((x) => x.monthly_sales <= 2).length
    }
  });
});

app.get("/api/v1/inventory/movements", authRequired, async (req, res) => {
  const barcode = String(req.query.barcode || "");
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT m.id, m.created_at AS time, m.store_code AS store, m.product_id, p.product_name, p.barcode,
              m.movement_type AS type, m.qty, m.reason, m.approved_by
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       WHERE (? = '' OR p.barcode = ?)
       ORDER BY m.id DESC`,
      [barcode, barcode]
    );
    return res.json({ data: rows });
  }
  const rows = barcode ? stockMovements.filter((m) => m.barcode === barcode) : stockMovements;
  res.json({ data: rows });
});

app.get("/api/v1/inventory/lots", authRequired, async (req, res) => {
  const store = String(req.query.store || "MAIN");
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT l.id, l.product_id, p.product_name, p.barcode, l.lot_no AS lot, l.qty, l.expiry_date AS expiry, l.supplier, l.store_code AS store
       FROM stock_lots l
       JOIN products p ON p.id = l.product_id
       WHERE l.store_code = ?
       ORDER BY l.expiry_date ASC`,
      [store]
    );
    return res.json({
      data: rows.map((x) => ({ ...x, days_left: x.expiry ? daysUntil(String(x.expiry).slice(0, 10)) : null }))
    });
  }
  const rows = stockLots
    .filter((l) => l.store === store)
    .map((x) => ({ ...x, days_left: daysUntil(x.expiry) }))
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  res.json({ data: rows });
});

app.post("/api/v1/inventory/receive", authRequired, async (req, res) => {
  const { barcode, quantity, reason, batch_no = "", expiry_date = "", supplier = "" } = req.body || {};
  const qty = Math.max(0, toNumber(quantity, 0));
  if (!barcode || qty < 1) return res.status(400).json({ message: "barcode and quantity are required" });
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT * FROM products WHERE barcode = ? LIMIT 1", [String(barcode).trim()]);
    const product = rows[0];
    if (!product) return res.status(404).json({ message: "Product not found by barcode" });
    await dbQuery("UPDATE products SET quantity = quantity + ? WHERE id = ?", [qty, product.id]);
    if (batch_no && expiry_date) {
      await dbQuery(
        "INSERT INTO stock_lots (product_id, lot_no, qty, expiry_date, supplier, store_code) VALUES (?, ?, ?, ?, ?, ?)",
        [product.id, String(batch_no), qty, String(expiry_date), String(supplier || product.supplier), product.store_code]
      );
    }
    const move = await dbQuery(
      `INSERT INTO inventory_movements (product_id, movement_type, qty, reason, store_code, approved_by)
       VALUES (?, 'RECEIVING', ?, ?, ?, ?)`,
      [product.id, qty, String(reason || "Supplier receiving"), product.store_code, req.user.full_name]
    );
    const updated = (await dbQuery("SELECT * FROM products WHERE id = ?", [product.id]))[0];
    return res.status(201).json({ data: { product: updated, movement: { id: move.insertId } } });
  }
  const product = products.find((p) => p.barcode === String(barcode).trim());
  if (!product) return res.status(404).json({ message: "Product not found by barcode" });

  product.quantity += qty;
  product.updated_at = nowIso();
  if (batch_no && expiry_date) {
    stockLots.push({
      id: stockLots.length + 1,
      product_id: product.id,
      product_name: product.product_name,
      barcode: product.barcode,
      lot: String(batch_no),
      qty,
      expiry: String(expiry_date),
      supplier: String(supplier || product.supplier),
      store: product.store
    });
  }
  const movement = {
    id: movementIdSeq++,
    time: nowIso(),
    store: product.store,
    product_id: product.id,
    product_name: product.product_name,
    barcode: product.barcode,
    type: "RECEIVING",
    qty,
    reason: String(reason || "Supplier receiving"),
    approved_by: req.user.full_name
  };
  stockMovements.unshift(movement);
  if (product.quantity < product.min_stock_level) {
    notifyFromInventory(product, "LOW_STOCK", `Stock is below minimum threshold (${product.quantity}/${product.min_stock_level}).`);
  }
  return res.status(201).json({ data: { product, movement } });
});

app.post("/api/v1/inventory/adjust", authRequired, async (req, res) => {
  const { barcode, action = "DECREASE", quantity, reason = "CORRECTION", approved_by = "" } = req.body || {};
  const qty = Math.max(0, toNumber(quantity, 0));
  if (!barcode || qty < 1) return res.status(400).json({ message: "barcode and quantity are required" });
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT * FROM products WHERE barcode = ? LIMIT 1", [String(barcode).trim()]);
    const product = rows[0];
    if (!product) return res.status(404).json({ message: "Product not found by barcode" });
    const nextAction = String(action).toUpperCase();
    if (nextAction === "INCREASE") {
      await dbQuery("UPDATE products SET quantity = quantity + ? WHERE id = ?", [qty, product.id]);
    } else {
      await dbQuery("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE id = ?", [qty, product.id]);
    }
    const move = await dbQuery(
      `INSERT INTO inventory_movements (product_id, movement_type, qty, reason, store_code, approved_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product.id, `ADJUST_${nextAction}`, qty, String(reason), product.store_code, String(approved_by || req.user.full_name)]
    );
    const updated = (await dbQuery("SELECT * FROM products WHERE id = ?", [product.id]))[0];
    return res.status(201).json({ data: { product: updated, movement: { id: move.insertId } } });
  }
  const product = products.find((p) => p.barcode === String(barcode).trim());
  if (!product) return res.status(404).json({ message: "Product not found by barcode" });
  const nextAction = String(action).toUpperCase();

  if (nextAction === "INCREASE") product.quantity += qty;
  else product.quantity = Math.max(0, product.quantity - qty);
  product.updated_at = nowIso();

  const movement = {
    id: movementIdSeq++,
    time: nowIso(),
    store: product.store,
    product_id: product.id,
    product_name: product.product_name,
    barcode: product.barcode,
    type: `ADJUST_${nextAction}`,
    qty,
    reason: String(reason),
    approved_by: String(approved_by || req.user.full_name)
  };
  stockMovements.unshift(movement);

  if (product.quantity < product.min_stock_level) {
    notifyFromInventory(product, "LOW_STOCK", `Stock is below minimum threshold (${product.quantity}/${product.min_stock_level}).`);
  }

  return res.status(201).json({ data: { product, movement } });
});

app.post("/api/v1/inventory/adjust/bulk", authRequired, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (isMysqlEnabled()) {
    let applied = 0;
    for (const r of rows) {
      const productRows = await dbQuery("SELECT * FROM products WHERE barcode = ? LIMIT 1", [String(r.barcode || "").trim()]);
      const product = productRows[0];
      if (!product) continue;
      const qty = Math.max(0, toNumber(r.quantity, 0));
      if (qty < 1) continue;
      const action = String(r.action || "DECREASE").toUpperCase();
      if (action === "INCREASE") {
        await dbQuery("UPDATE products SET quantity = quantity + ? WHERE id = ?", [qty, product.id]);
      } else {
        await dbQuery("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE id = ?", [qty, product.id]);
      }
      await dbQuery(
        `INSERT INTO inventory_movements (product_id, movement_type, qty, reason, store_code, approved_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product.id, `BULK_${action}`, qty, String(r.reason || "BULK"), product.store_code, String(r.approved_by || req.user.full_name)]
      );
      applied += 1;
    }
    return res.json({ data: { applied } });
  }
  let applied = 0;
  rows.forEach((r) => {
    const product = products.find((p) => p.barcode === String(r.barcode || "").trim());
    if (!product) return;
    const qty = Math.max(0, toNumber(r.quantity, 0));
    if (qty < 1) return;
    const action = String(r.action || "DECREASE").toUpperCase();
    if (action === "INCREASE") product.quantity += qty;
    else product.quantity = Math.max(0, product.quantity - qty);
    product.updated_at = nowIso();
    stockMovements.unshift({
      id: movementIdSeq++,
      time: nowIso(),
      store: product.store,
      product_id: product.id,
      product_name: product.product_name,
      barcode: product.barcode,
      type: `BULK_${action}`,
      qty,
      reason: String(r.reason || "BULK"),
      approved_by: String(r.approved_by || req.user.full_name)
    });
    applied += 1;
  });
  res.json({ data: { applied } });
});

// ===== sales =====
app.get("/api/v1/sales", authRequired, async (req, res) => {
  const limit = clamp(toNumber(req.query.limit, 20), 1, 100);
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, sale_code AS sale_id, sale_time, payment_method, customer_name, customer_phone,
              subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, total_khr, paid_amount,
              change_amount AS \`change\`, sync_status, is_refund, refund_reason, created_by
       FROM sales
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
    for (const row of rows) {
      const items = await dbQuery(
        `SELECT si.product_id, p.product_name, p.barcode, si.qty, si.unit_price, si.cost_price, si.line_total
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`,
        [row.id]
      );
      row.items = items;
      delete row.id;
    }
    return res.json({ data: rows });
  }
  res.json({ data: sales.slice(0, limit) });
});

app.post("/api/v1/sales", authRequired, async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return res.status(400).json({ message: "items are required" });
  const payment_method = String(body.payment_method || "CASH");
  if (!["CASH", "BANK_TRANSFER"].includes(payment_method)) {
    return res.status(400).json({ message: "payment_method must be CASH or BANK_TRANSFER" });
  }

  const normalizedItems = [];
  if (isMysqlEnabled()) {
    for (const item of items) {
      const barcode = String(item.barcode || "").trim();
      const qty = Math.max(0, toNumber(item.qty, 0));
      if (!barcode || qty < 1) return res.status(400).json({ message: "each item requires barcode and qty" });
      const productRows = await dbQuery("SELECT * FROM products WHERE barcode = ? LIMIT 1", [barcode]);
      const product = productRows[0];
      if (!product) return res.status(404).json({ message: `Product not found: ${barcode}` });
      if (Number(product.quantity) < qty) return res.status(400).json({ message: `Insufficient stock for ${product.product_name}` });
      normalizedItems.push({
        product_id: product.id,
        product_name: product.product_name,
        barcode: product.barcode,
        qty,
        unit_price: Number(product.selling_price),
        cost_price: Number(product.cost_price),
        line_total: Number((qty * Number(product.selling_price)).toFixed(2))
      });
    }

    const subtotal = normalizedItems.reduce((sum, i) => sum + i.line_total, 0);
    const discount_pct = clamp(toNumber(body.discount_pct, 0), 0, 100);
    const tax_pct = clamp(toNumber(body.tax_pct, 0), 0, 100);
    const discount_amount = Number((subtotal * (discount_pct / 100)).toFixed(2));
    const taxable = subtotal - discount_amount;
    const tax_amount = Number((taxable * (tax_pct / 100)).toFixed(2));
    const total = Number((taxable + tax_amount).toFixed(2));
    const khr_rate = Math.max(1, toNumber(body.khr_rate, 4100));
    const total_khr = Number((total * khr_rate).toFixed(0));
    const paid_amount = Number(toNumber(body.paid_amount, total).toFixed(2));
    if (paid_amount < total) return res.status(400).json({ message: "paid_amount is less than total" });
    const change = Number((paid_amount - total).toFixed(2));

    const saleCode = `S${Date.now()}`;
    const saleInsert = await dbQuery(
      `INSERT INTO sales
      (sale_code, sale_time, payment_method, customer_name, customer_phone, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, khr_rate, total_khr, paid_amount, change_amount, sync_status, is_refund, created_by)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', 0, ?)`,
      [
        saleCode,
        payment_method,
        String(body.customer_name || "-"),
        String(body.customer_phone || "-"),
        Number(subtotal.toFixed(2)),
        discount_pct,
        discount_amount,
        tax_pct,
        tax_amount,
        total,
        khr_rate,
        total_khr,
        paid_amount,
        change,
        req.user.full_name
      ]
    );
    const saleId = saleInsert.insertId;

    for (const i of normalizedItems) {
      await dbQuery(
        "INSERT INTO sale_items (sale_id, product_id, qty, unit_price, cost_price, line_total) VALUES (?, ?, ?, ?, ?, ?)",
        [saleId, i.product_id, i.qty, i.unit_price, i.cost_price, i.line_total]
      );
      await dbQuery(
        "UPDATE products SET quantity = GREATEST(0, quantity - ?), monthly_sales = monthly_sales + ? WHERE id = ?",
        [i.qty, i.qty, i.product_id]
      );
    }

    const sale = {
      sale_id: saleCode,
      sale_time: nowIso(),
      items: normalizedItems,
      payment_method,
      customer_name: String(body.customer_name || "-"),
      customer_phone: String(body.customer_phone || "-"),
      subtotal: Number(subtotal.toFixed(2)),
      discount_pct,
      discount_amount,
      tax_pct,
      tax_amount,
      total,
      total_khr,
      paid_amount,
      change,
      sync_status: "SYNCED",
      is_refund: false,
      created_by: req.user.full_name
    };
    return res.status(201).json({ data: sale });
  }
  for (const item of items) {
    const barcode = String(item.barcode || "").trim();
    const qty = Math.max(0, toNumber(item.qty, 0));
    if (!barcode || qty < 1) return res.status(400).json({ message: "each item requires barcode and qty" });
    const product = products.find((p) => p.barcode === barcode);
    if (!product) return res.status(404).json({ message: `Product not found: ${barcode}` });
    if (product.quantity < qty) return res.status(400).json({ message: `Insufficient stock for ${product.product_name}` });
    normalizedItems.push({
      product_id: product.id,
      product_name: product.product_name,
      barcode: product.barcode,
      qty,
      unit_price: Number(product.selling_price),
      cost_price: Number(product.cost_price),
      line_total: Number((qty * Number(product.selling_price)).toFixed(2))
    });
  }

  normalizedItems.forEach((i) => {
    const p = products.find((x) => x.id === i.product_id);
    p.quantity = Math.max(0, p.quantity - i.qty);
    p.monthly_sales += i.qty;
    p.updated_at = nowIso();
    if (p.quantity < p.min_stock_level) {
      notifyFromInventory(p, "LOW_STOCK", `Stock is below minimum threshold (${p.quantity}/${p.min_stock_level}).`);
    }
  });

  const subtotal = normalizedItems.reduce((sum, i) => sum + i.line_total, 0);
  const discount_pct = clamp(toNumber(body.discount_pct, 0), 0, 100);
  const tax_pct = clamp(toNumber(body.tax_pct, 0), 0, 100);
  const discount_amount = Number((subtotal * (discount_pct / 100)).toFixed(2));
  const taxable = subtotal - discount_amount;
  const tax_amount = Number((taxable * (tax_pct / 100)).toFixed(2));
  const total = Number((taxable + tax_amount).toFixed(2));
  const khr_rate = Math.max(1, toNumber(body.khr_rate, 4100));
  const total_khr = Number((total * khr_rate).toFixed(0));
  const paid_amount = Number(toNumber(body.paid_amount, total).toFixed(2));
  if (paid_amount < total) return res.status(400).json({ message: "paid_amount is less than total" });
  const change = Number((paid_amount - total).toFixed(2));

  const sale = {
    sale_id: ++saleIdSeq,
    sale_time: nowIso(),
    items: normalizedItems,
    payment_method,
    customer_name: String(body.customer_name || "-"),
    customer_phone: String(body.customer_phone || "-"),
    subtotal: Number(subtotal.toFixed(2)),
    discount_pct,
    discount_amount,
    tax_pct,
    tax_amount,
    total,
    total_khr,
    paid_amount,
    change,
    sync_status: "SYNCED",
    is_refund: false,
    created_by: req.user.full_name
  };
  sales.unshift(sale);
  res.status(201).json({ data: sale });
});

app.post("/api/v1/sales/refund", authRequired, async (req, res) => {
  const saleId = toNumber(req.body?.sale_id, -1);
  const saleCode = String(req.body?.sale_id || "").trim();
  const reason = String(req.body?.reason || "Refund");
  if (isMysqlEnabled()) {
    const saleRows = await dbQuery(
      "SELECT * FROM sales WHERE (id = ? OR sale_code = ?) AND is_refund = 0 LIMIT 1",
      [saleId, saleCode]
    );
    const source = saleRows[0];
    if (!source) return res.status(404).json({ message: "Sale not found" });
    const items = await dbQuery("SELECT * FROM sale_items WHERE sale_id = ?", [source.id]);
    for (const i of items) {
      await dbQuery(
        "UPDATE products SET quantity = quantity + ?, monthly_sales = GREATEST(0, monthly_sales - ?) WHERE id = ?",
        [Number(i.qty || 0), Number(i.qty || 0), i.product_id]
      );
    }
    const refundCode = `R${Date.now()}`;
    const refundInsert = await dbQuery(
      `INSERT INTO sales
      (sale_code, sale_time, payment_method, customer_name, customer_phone, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, khr_rate, total_khr, paid_amount, change_amount, sync_status, is_refund, refund_reason, source_sale_id, created_by)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SYNCED', 1, ?, ?, ?)`,
      [
        refundCode,
        source.payment_method,
        source.customer_name,
        source.customer_phone,
        source.subtotal,
        source.discount_pct,
        source.discount_amount,
        source.tax_pct,
        source.tax_amount,
        Number((-1 * Number(source.total || 0)).toFixed(2)),
        source.khr_rate,
        Number((-1 * Number(source.total_khr || 0)).toFixed(0)),
        Number((-1 * Number(source.paid_amount || 0)).toFixed(2)),
        reason,
        source.id,
        req.user.full_name
      ]
    );
    for (const i of items) {
      await dbQuery(
        "INSERT INTO sale_items (sale_id, product_id, qty, unit_price, cost_price, line_total) VALUES (?, ?, ?, ?, ?, ?)",
        [refundInsert.insertId, i.product_id, i.qty, i.unit_price, i.cost_price, -1 * Number(i.line_total || 0)]
      );
    }
    return res.status(201).json({ data: { sale_id: refundCode, is_refund: true, refund_reason: reason } });
  }
  const source = sales.find((s) => s.sale_id === saleId && !s.is_refund);
  if (!source) return res.status(404).json({ message: "Sale not found" });

  (source.items || []).forEach((i) => {
    const p = products.find((x) => x.id === i.product_id);
    if (p) {
      p.quantity += Number(i.qty || 0);
      p.monthly_sales = Math.max(0, p.monthly_sales - Number(i.qty || 0));
      p.updated_at = nowIso();
    }
  });

  const refund = {
    ...source,
    sale_id: ++saleIdSeq,
    sale_time: nowIso(),
    total: Number((-1 * source.total).toFixed(2)),
    total_khr: Number((-1 * source.total_khr).toFixed(0)),
    paid_amount: Number((-1 * source.paid_amount).toFixed(2)),
    change: 0,
    is_refund: true,
    refund_reason: reason,
    created_by: req.user.full_name
  };
  sales.unshift(refund);
  res.status(201).json({ data: refund });
});

app.post("/api/v1/sales/shift-close", authRequired, async (req, res) => {
  const payload = req.body || {};
  if (isMysqlEnabled()) {
    const cashRows = await dbQuery("SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE is_refund = 0 AND payment_method = 'CASH'");
    const cashSales = Number(cashRows[0]?.s || 0);
    const record = {
      opening_cash: toNumber(payload.opening_cash, 0),
      cash_in: toNumber(payload.cash_in, 0),
      cash_out: toNumber(payload.cash_out, 0),
      cash_sales_total: cashSales,
      note: String(payload.note || "")
    };
    record.expected_drawer = Number((record.opening_cash + record.cash_in - record.cash_out + record.cash_sales_total).toFixed(2));
    const result = await dbQuery(
      `INSERT INTO shift_closures (opening_cash, cash_in, cash_out, cash_sales_total, expected_drawer, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.opening_cash, record.cash_in, record.cash_out, record.cash_sales_total, record.expected_drawer, record.note, req.user.full_name]
    );
    return res.status(201).json({ data: { id: result.insertId, created_at: nowIso(), created_by: req.user.full_name, ...record } });
  }
  const record = {
    id: shiftClosures.length + 1,
    created_at: nowIso(),
    created_by: req.user.full_name,
    opening_cash: toNumber(payload.opening_cash, 0),
    cash_in: toNumber(payload.cash_in, 0),
    cash_out: toNumber(payload.cash_out, 0),
    cash_sales_total: sales.filter((s) => !s.is_refund && s.payment_method === "CASH").reduce((sum, s) => sum + s.total, 0),
    note: String(payload.note || "")
  };
  record.expected_drawer = Number((record.opening_cash + record.cash_in - record.cash_out + record.cash_sales_total).toFixed(2));
  shiftClosures.unshift(record);
  res.status(201).json({ data: record });
});

app.get("/api/v1/sales/shift-closures", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, opening_cash, cash_in, cash_out, cash_sales_total, expected_drawer, note, created_by, created_at
       FROM shift_closures
       ORDER BY id DESC
       LIMIT 20`
    );
    return res.json({
      data: rows.map((row) => ({
        id: Number(row.id),
        opening_cash: Number(row.opening_cash || 0),
        cash_in: Number(row.cash_in || 0),
        cash_out: Number(row.cash_out || 0),
        cash_sales_total: Number(row.cash_sales_total || 0),
        expected_drawer: Number(row.expected_drawer || 0),
        note: row.note || "",
        created_by: row.created_by || "-",
        created_at: row.created_at
      }))
    });
  }
  return res.json({ data: shiftClosures.slice(0, 20) });
});

// ===== reports =====
function computeReport(type) {
  if (type === "sales-daily") {
    const map = new Map();
    sales
      .filter((s) => !s.is_refund)
      .forEach((s) => {
        const key = String(s.sale_time).slice(0, 10);
        const row = map.get(key) || { date: key, txns: 0, units: 0, amount: 0, cogs: 0, gross_profit: 0, margin_pct: 0, cash: 0, bank_transfer: 0 };
        row.txns += 1;
        row.units += (s.items || []).reduce((sum, i) => sum + Number(i.qty || 0), 0);
        row.amount += Number(s.total || 0);
        row.cogs += (s.items || []).reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.cost_price || 0), 0);
        if (s.payment_method === "CASH") row.cash += Number(s.total || 0);
        if (s.payment_method === "BANK_TRANSFER") row.bank_transfer += Number(s.total || 0);
        map.set(key, row);
      });
    return Array.from(map.values())
      .map((r) => {
        r.gross_profit = Number((r.amount - r.cogs).toFixed(2));
        r.margin_pct = r.amount ? Number((((r.amount - r.cogs) / r.amount) * 100).toFixed(2)) : 0;
        r.amount = Number(r.amount.toFixed(2));
        r.cogs = Number(r.cogs.toFixed(2));
        r.cash = Number(r.cash.toFixed(2));
        r.bank_transfer = Number(r.bank_transfer.toFixed(2));
        return r;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  if (type === "stock-low") {
    return products
      .filter((p) => p.quantity < p.min_stock_level)
      .map((p) => ({
        product: p.product_name,
        barcode: p.barcode,
        qty: p.quantity,
        min: p.min_stock_level,
        category: p.category_name,
        supplier: p.supplier,
        value_at_risk: Number((Math.max(0, p.min_stock_level - p.quantity) * p.cost_price).toFixed(2))
      }));
  }

  if (type === "stock-expiry") {
    return products
      .filter((p) => p.expiry_date)
      .map((p) => ({
        product: p.product_name,
        barcode: p.barcode,
        qty: p.quantity,
        expiry: p.expiry_date,
        days_left: daysUntil(p.expiry_date),
        category: p.category_name,
        value_at_risk: Number((p.qty * p.cost_price).toFixed(2))
      }))
      .filter((r) => r.days_left !== null)
      .sort((a, b) => a.days_left - b.days_left);
  }

  if (type === "ai-reorder") {
    return products.map((p) => {
      const avg_day = Number((p.monthly_sales / 30).toFixed(2));
      const lead = 7;
      const reorder_level = Number((avg_day * lead + 5).toFixed(2));
      return {
        product: p.product_name,
        avg_day,
        lead,
        reorder_level,
        stock: p.quantity,
        suggest_qty: Math.max(0, Math.ceil(reorder_level - p.quantity)),
        selected_model: p.id % 2 === 0 ? "ARIMA" : "PROPHET",
        confidence: "80-95%"
      };
    });
  }

  if (type === "category-contrib") {
    const map = new Map();
    sales
      .filter((s) => !s.is_refund)
      .forEach((s) => {
        (s.items || []).forEach((i) => {
          const p = products.find((x) => x.id === i.product_id);
          if (!p) return;
          const current = map.get(p.category_name) || 0;
          map.set(p.category_name, current + Number(i.line_total || 0));
        });
      });
    const total = Array.from(map.values()).reduce((sum, x) => sum + x, 0) || 1;
    return Array.from(map.entries()).map(([category, revenue]) => ({
      category,
      revenue: Number(revenue.toFixed(2)),
      contribution_pct: Number(((revenue / total) * 100).toFixed(2))
    }));
  }

  if (type === "payment-method") {
    const map = new Map();
    sales.filter((s) => !s.is_refund).forEach((s) => {
      map.set(s.payment_method, (map.get(s.payment_method) || 0) + Number(s.total || 0));
    });
    const total = Array.from(map.values()).reduce((sum, x) => sum + x, 0) || 1;
    return Array.from(map.entries()).map(([method, amount]) => ({
      method,
      amount: Number(amount.toFixed(2)),
      pct: Number(((amount / total) * 100).toFixed(2))
    }));
  }

  // monthly / quarterly / annual simplification
  const base = sales.filter((s) => !s.is_refund);
  const totalTx = base.length;
  const totalUnits = base.reduce((sum, s) => sum + (s.items || []).reduce((acc, i) => acc + Number(i.qty || 0), 0), 0);
  const totalAmt = base.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalCogs = base.reduce((sum, s) => sum + (s.items || []).reduce((acc, i) => acc + Number(i.qty || 0) * Number(i.cost_price || 0), 0), 0);
  const totalGross = totalAmt - totalCogs;
  const totalMargin = totalAmt ? (totalGross / totalAmt) * 100 : 0;
  if (type === "sales-monthly") {
    return [{ period: "2026-03", txns: totalTx, units: totalUnits, amount: Number(totalAmt.toFixed(2)), cogs: Number(totalCogs.toFixed(2)), gross_profit: Number(totalGross.toFixed(2)), margin_pct: Number(totalMargin.toFixed(2)), growth_pct: 0 }];
  }
  if (type === "sales-quarterly") {
    return [{ period: "2026-Q1", txns: totalTx, units: totalUnits, amount: Number(totalAmt.toFixed(2)), cogs: Number(totalCogs.toFixed(2)), gross_profit: Number(totalGross.toFixed(2)), margin_pct: Number(totalMargin.toFixed(2)), growth_pct: 0 }];
  }
  if (type === "sales-annual") {
    return [{ period: "2026", txns: totalTx, units: totalUnits, amount: Number(totalAmt.toFixed(2)), cogs: Number(totalCogs.toFixed(2)), gross_profit: Number(totalGross.toFixed(2)), margin_pct: Number(totalMargin.toFixed(2)), growth_pct: 0 }];
  }
  return [];
}

async function computeReportFromDb(type) {
  if (type === "stock-low") {
    return dbQuery(
      `SELECT p.product_name AS product, p.barcode, p.quantity AS qty, p.min_stock_level AS min,
              COALESCE(c.name_en, 'General') AS category, p.supplier,
              ROUND(GREATEST(0, p.min_stock_level - p.quantity) * p.cost_price, 2) AS value_at_risk
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.quantity < p.min_stock_level`
    );
  }
  if (type === "stock-expiry") {
    return dbQuery(
      `SELECT p.product_name AS product, p.barcode, p.quantity AS qty, p.expiry_date AS expiry,
              DATEDIFF(p.expiry_date, CURDATE()) AS days_left, COALESCE(c.name_en, 'General') AS category,
              ROUND(p.quantity * p.cost_price, 2) AS value_at_risk
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.expiry_date IS NOT NULL
       ORDER BY p.expiry_date ASC`
    );
  }
  if (type === "payment-method") {
    return dbQuery(
      `SELECT payment_method AS method, ROUND(SUM(total),2) AS amount,
              ROUND(100 * SUM(total) / NULLIF((SELECT SUM(total) FROM sales WHERE is_refund = 0),0),2) AS pct
       FROM sales
       WHERE is_refund = 0
       GROUP BY payment_method`
    );
  }
  if (type === "sales-daily") {
    return dbQuery(
      `SELECT DATE(s.sale_time) AS date,
              COUNT(DISTINCT s.id) AS txns,
              ROUND(COALESCE(SUM(si.qty),0),2) AS units,
              ROUND(COALESCE(SUM(s.total),0),2) AS amount,
              ROUND(COALESCE(SUM(si.qty * si.cost_price),0),2) AS cogs
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.is_refund = 0
       GROUP BY DATE(s.sale_time)
       ORDER BY DATE(s.sale_time) DESC`
    ).then((rows) =>
      rows.map((r) => {
        const gross = Number(r.amount || 0) - Number(r.cogs || 0);
        return {
          ...r,
          gross_profit: Number(gross.toFixed(2)),
          margin_pct: Number(r.amount ? ((gross / Number(r.amount)) * 100).toFixed(2) : 0),
          cash: 0,
          bank_transfer: 0
        };
      })
    );
  }
  return [];
}

app.get("/api/v1/reports/run", authRequired, async (req, res) => {
  const type = String(req.query.type || "sales-daily");
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  const compare_prev = String(req.query.compare_prev || "false") === "true";
  const rows = isMysqlEnabled() ? await computeReportFromDb(type) : computeReport(type);
  const run = {
    id: reportRunIdSeq++,
    type,
    generated_at: nowIso(),
    generated_by: req.user.full_name,
    filter: `${from || "-"} to ${to || "-"}`,
    compare_prev
  };
  if (isMysqlEnabled()) {
    const result = await dbQuery(
      "INSERT INTO report_runs (report_type, filter_text, compare_prev, generated_by) VALUES (?, ?, ?, ?)",
      [type, `${from || "-"} to ${to || "-"}`, compare_prev ? 1 : 0, req.user.full_name]
    );
    run.id = result.insertId;
  }
  reportRuns.unshift(run);
  res.json({ data: { rows, meta: run } });
});

app.get("/api/v1/reports/history", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, report_type AS type, generated_at, generated_by, filter_text AS filter, compare_prev
       FROM report_runs ORDER BY id DESC LIMIT 100`
    );
    return res.json({ data: rows.map((r) => ({ ...r, compare_prev: asBool(r.compare_prev) })) });
  }
  res.json({ data: reportRuns });
});

app.post("/api/v1/reports/export", authRequired, async (req, res) => {
  const { type = "sales-daily", format = "CSV" } = req.body || {};
  const rows = isMysqlEnabled() ? await computeReportFromDb(String(type)) : computeReport(String(type));
  const normalizedFormat = String(format).toUpperCase();
  if (normalizedFormat === "CSV") {
    if (!rows.length) return res.json({ data: { content: "", filename: "report.csv", format: "CSV" } });
    const keys = Object.keys(rows[0]);
    const lines = [keys.join(",")];
    rows.forEach((r) => lines.push(keys.map((k) => csvEscape(r[k])).join(",")));
    return res.json({ data: { format: "CSV", filename: `report-${type}.csv`, content: lines.join("\n") } });
  }
  if (normalizedFormat === "PDF") {
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    const pdf = buildPdfDocument({
      title: "AI Inventory Report",
      subtitle: `Type: ${type} | Generated: ${nowIso()}`,
      lines: rows.length
        ? rows.map((row, index) => `${index + 1}. ${keys.map((key) => `${key}=${row[key] ?? "-"}`).join(" | ")}`)
        : ["No data"]
    });
    return res.json({
      data: {
        format: "PDF",
        filename: `report-${type}.pdf`,
        content: pdf.toString("base64"),
        encoding: "base64"
      }
    });
  }
  if (normalizedFormat === "XLSX") {
    const xlsx = buildXlsxDocument(type, rows);
    return res.json({
      data: {
        format: "XLSX",
        filename: `report-${type}.xlsx`,
        content: xlsx.toString("base64"),
        encoding: "base64"
      }
    });
  }
  return res.status(400).json({ message: `${normalizedFormat} export is not available yet` });
});

app.post("/api/v1/reports/schedule", authRequired, async (req, res) => {
  const body = req.body || {};
  if (isMysqlEnabled()) {
    const type = String(body.type || "sales-daily");
    const schedule = String(body.schedule || "NONE");
    const toEmail = String(body.to_email || "");
    const existing = await dbQuery("SELECT id FROM report_schedules WHERE report_type = ? LIMIT 1", [type]);
    if (existing[0]) {
      await dbQuery(
        "UPDATE report_schedules SET schedule_code = ?, to_email = ?, active = 1, updated_by = ? WHERE id = ?",
        [schedule, toEmail, req.user.full_name, existing[0].id]
      );
    } else {
      await dbQuery(
        "INSERT INTO report_schedules (report_type, schedule_code, to_email, active, updated_by) VALUES (?, ?, ?, 1, ?)",
        [type, schedule, toEmail, req.user.full_name]
      );
    }
  }
  res.json({
    data: {
      schedule: String(body.schedule || "NONE"),
      to_email: String(body.to_email || ""),
      updated_by: req.user.full_name,
      updated_at: nowIso()
    }
  });
});

// ===== AI forecast =====
app.get("/api/v1/ai/model-performance", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT category_name AS category, prophet_mape, arima_mape, prophet_mae, arima_mae, prophet_rmse, arima_rmse, selected_model AS selected
       FROM ai_model_performance ORDER BY id ASC`
    );
    return res.json({ data: rows });
  }
  res.json({ data: aiModelPerformance });
});

app.get("/api/v1/ai/forecast/versions", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, version_code AS version, product_id AS product, model_name AS model, generated_at, horizon_days AS horizon, mape
       FROM ai_forecast_versions ORDER BY id DESC`
    );
    return res.json({ data: rows });
  }
  res.json({ data: aiForecastVersions });
});

app.get("/api/v1/ai/forecast/history", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, created_at AS time, product_id AS product, horizon_days AS horizon, selected_model AS selected, mae, mape, rmse
       FROM ai_forecast_runs ORDER BY id DESC`
    );
    return res.json({ data: rows });
  }
  res.json({ data: aiForecastHistory });
});

app.post("/api/v1/ai/forecast/run", authRequired, async (req, res) => {
  const productId = toNumber(req.body?.product_id, 1);
  const days = clamp(toNumber(req.body?.days, 30), 1, 180);
  const lead = clamp(toNumber(req.body?.lead, 7), 1, 60);
  if (isMysqlEnabled()) {
    const productRows = await dbQuery("SELECT * FROM products WHERE id = ? LIMIT 1", [productId]);
    const p = productRows[0] || (await dbQuery("SELECT * FROM products ORDER BY id LIMIT 1"))[0];
    if (!p) return res.status(400).json({ message: "No products found" });
    const avg = Number((Number(p.monthly_sales || 0) / 30).toFixed(2));
    const total = Number((avg * days).toFixed(2));
    const reorder = Number((avg * lead + 5).toFixed(2));
    const ciLow = Number((total * 0.85).toFixed(2));
    const ciHigh = Number((total * 1.15).toFixed(2));
    const model = productId % 2 === 0 ? "ARIMA" : "PROPHET";
    const mape = model === "ARIMA" ? 14.1 : 13.4;
    const mae = model === "ARIMA" ? 3.5 : 3.1;
    const rmse = model === "ARIMA" ? 5.0 : 4.8;
    const runResult = await dbQuery(
      `INSERT INTO ai_forecast_runs
      (product_id, horizon_days, selected_model, mae, mape, rmse, avg_daily_demand, forecast_total, reorder_level, ci_low, ci_high)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, days, model, mae, mape, rmse, avg, total, reorder, ciLow, ciHigh]
    );
    await dbQuery(
      `INSERT INTO ai_forecast_versions (version_code, product_id, model_name, horizon_days, mape, generated_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [`FCAST-${new Date().toISOString().slice(0, 10)}-${String(runResult.insertId).padStart(2, "0")}`, p.id, model, days, mape]
    );
    const reorderRecommendations = (await dbQuery("SELECT * FROM products")).map((x) => {
      const avgDay = Number((Number(x.monthly_sales || 0) / 30).toFixed(2));
      const reorderLevel = Number((avgDay * 7 + 5).toFixed(2));
      return {
        product: x.product_name,
        avg_day: avgDay,
        lead: 7,
        reorder: reorderLevel,
        stock: Number(x.quantity || 0),
        suggest: Math.max(0, Math.ceil(reorderLevel - Number(x.quantity || 0))),
        reorder_date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        urgency: Number(x.quantity || 0) <= Number(x.min_stock_level || 0) ? "HIGH" : "MEDIUM"
      };
    });
    return res.status(201).json({
      data: {
        forecast: { avg, total, reorder, ci_low: ciLow, ci_high: ciHigh, model },
        run: { id: runResult.insertId, time: nowIso(), product: p.id, horizon: days, selected: model, mae, mape, rmse },
        reorder_recommendations: reorderRecommendations
      }
    });
  }
  const p = products.find((x) => x.id === productId) || products[0];
  const avg = Number((p.monthly_sales / 30).toFixed(2));
  const total = Number((avg * days).toFixed(2));
  const reorder = Number((avg * lead + 5).toFixed(2));
  const ciLow = Number((total * 0.85).toFixed(2));
  const ciHigh = Number((total * 1.15).toFixed(2));
  const model = productId % 2 === 0 ? "ARIMA" : "PROPHET";
  const mape = model === "ARIMA" ? 14.1 : 13.4;
  const run = {
    id: Date.now(),
    time: nowIso(),
    product: productId,
    horizon: days,
    selected: model,
    mae: model === "ARIMA" ? 3.5 : 3.1,
    mape,
    rmse: model === "ARIMA" ? 5.0 : 4.8
  };
  aiForecastHistory.unshift(run);
  aiForecastVersions.unshift({
    id: ++forecastVersionSeq,
    version: `FCAST-${new Date().toISOString().slice(0, 10)}-${String(forecastVersionSeq).padStart(2, "0")}`,
    product: productId,
    model,
    generated_at: new Date().toLocaleString(),
    horizon: days,
    mape
  });
  const reorderRecommendations = products.map((x) => {
    const avgDay = Number((x.monthly_sales / 30).toFixed(2));
    const reorderLevel = Number((avgDay * 7 + 5).toFixed(2));
    return {
      product: x.product_name,
      avg_day: avgDay,
      lead: 7,
      reorder: reorderLevel,
      stock: x.quantity,
      suggest: Math.max(0, Math.ceil(reorderLevel - x.quantity)),
      reorder_date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      urgency: x.quantity <= x.min_stock_level ? "HIGH" : "MEDIUM"
    };
  });
  if (req.body?.alert_auto) {
    notifications.unshift({
      id: ++notificationIdSeq,
      time: new Date().toLocaleString(),
      type: "REORDER_AI",
      priority: "MEDIUM",
      product: p.product_name,
      message: `AI recommends reorder quantity based on ${model}.`,
      channel: "IN_APP",
      delivery_status: "SENT",
      read: false,
      acknowledged: false,
      snoozed_until: "-",
      source_link: "/ai",
      read_by: "-",
      read_at: "-"
    });
  }
  res.status(201).json({
    data: {
      forecast: { avg, total, reorder, ci_low: ciLow, ci_high: ciHigh, model },
      run,
      reorder_recommendations: reorderRecommendations
    }
  });
});

app.post("/api/v1/ai/forecast/bulk-run", authRequired, async (req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT id FROM products");
    return res.json({
      data: {
        status: "COMPLETED",
        progress: 100,
        processed_products: rows.length
      }
    });
  }
  const alertAuto = Boolean(req.body?.alert_auto);
  if (alertAuto) {
    notifications.unshift({
      id: ++notificationIdSeq,
      time: new Date().toLocaleString(),
      type: "REORDER_AI",
      priority: "MEDIUM",
      product: "Bulk Forecast",
      message: "Bulk AI forecast completed and restock candidates generated.",
      channel: "IN_APP",
      delivery_status: "SENT",
      read: false,
      acknowledged: false,
      snoozed_until: "-",
      source_link: "/ai",
      read_by: "-",
      read_at: "-"
    });
  }
  res.json({
    data: {
      status: "COMPLETED",
      progress: 100,
      processed_products: products.length
    }
  });
});

// ===== notifications =====
app.get("/api/v1/notifications", authRequired, async (req, res) => {
  const type = String(req.query.type || "ALL");
  const status = String(req.query.status || "ALL");
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT n.id, DATE_FORMAT(n.notification_time, '%Y-%m-%d %H:%i') AS time,
              n.notification_type AS type, n.priority, COALESCE(p.product_name, '-') AS product, n.message, n.channel,
              n.delivery_status, n.is_read AS read, n.acknowledged, COALESCE(DATE_FORMAT(n.snoozed_until, '%Y-%m-%d %H:%i'), '-') AS snoozed_until,
              n.source_link, COALESCE(u.full_name, '-') AS read_by, COALESCE(DATE_FORMAT(n.read_at, '%Y-%m-%d %H:%i'), '-') AS read_at
       FROM notifications n
       LEFT JOIN products p ON p.id = n.product_id
       LEFT JOIN users u ON u.id = n.read_by
       WHERE (? = 'ALL' OR n.notification_type = ?)
         AND (
           ? = 'ALL' OR
           (? = 'READ' AND n.is_read = 1) OR
           (? = 'UNREAD' AND n.is_read = 0) OR
           (? = 'FAILED' AND n.delivery_status = 'FAILED')
         )
       ORDER BY n.id DESC`,
      [type, type, status, status, status, status]
    );
    return res.json({ data: rows.map((r) => ({ ...r, read: asBool(r.read), acknowledged: asBool(r.acknowledged) })) });
  }
  let rows = [...notifications];
  if (type !== "ALL") rows = rows.filter((n) => n.type === type);
  if (status === "READ") rows = rows.filter((n) => n.read);
  if (status === "UNREAD") rows = rows.filter((n) => !n.read);
  if (status === "FAILED") rows = rows.filter((n) => n.delivery_status === "FAILED");
  res.json({ data: rows });
});

app.patch("/api/v1/notifications/:id/read", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const found = await dbQuery("SELECT id FROM notifications WHERE id = ? LIMIT 1", [id]);
    if (!found[0]) return res.status(404).json({ message: "Notification not found" });
    await dbQuery("UPDATE notifications SET is_read = 1, read_by = ?, read_at = NOW() WHERE id = ?", [req.user.id, id]);
    const row = (await dbQuery("SELECT * FROM notifications WHERE id = ?", [id]))[0];
    return res.json({ data: row });
  }
  const item = notifications.find((n) => n.id === id);
  if (!item) return res.status(404).json({ message: "Notification not found" });
  item.read = true;
  item.read_by = req.user.full_name;
  item.read_at = new Date().toLocaleString();
  res.json({ data: item });
});

app.patch("/api/v1/notifications/read-all", authRequired, async (req, res) => {
  if (isMysqlEnabled()) {
    const result = await dbQuery("UPDATE notifications SET is_read = 1, read_by = ?, read_at = NOW() WHERE is_read = 0", [req.user.id]);
    return res.json({ data: { updated: result.affectedRows || 0 } });
  }
  notifications.forEach((n) => {
    n.read = true;
    n.read_by = "Demo Admin";
    n.read_at = new Date().toLocaleString();
  });
  res.json({ data: { updated: notifications.length } });
});

app.patch("/api/v1/notifications/bulk-action", authRequired, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => toNumber(x, -1)) : [];
  const action = String(req.body?.action || "").toUpperCase();
  if (isMysqlEnabled()) {
    if (!ids.length) return res.json({ data: { action, updated: 0 } });
    const placeholders = ids.map(() => "?").join(",");
    let sql = "";
    let params = [...ids];
    if (action === "ACKNOWLEDGE") sql = `UPDATE notifications SET acknowledged = 1 WHERE id IN (${placeholders})`;
    if (action === "SNOOZE_1H") sql = `UPDATE notifications SET snoozed_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id IN (${placeholders})`;
    if (action === "ESCALATE") sql = `UPDATE notifications SET priority = 'HIGH' WHERE id IN (${placeholders})`;
    if (action === "MARK_READ") {
      sql = `UPDATE notifications SET is_read = 1, read_by = ?, read_at = NOW() WHERE id IN (${placeholders})`;
      params = [req.user.id, ...ids];
    }
    if (!sql) return res.json({ data: { action, updated: 0 } });
    const result = await dbQuery(sql, params);
    return res.json({ data: { action, updated: result.affectedRows || 0 } });
  }
  let updated = 0;
  notifications.forEach((n) => {
    if (!ids.includes(n.id)) return;
    if (action === "ACKNOWLEDGE") n.acknowledged = true;
    if (action === "SNOOZE_1H") n.snoozed_until = new Date(Date.now() + 3600 * 1000).toLocaleString();
    if (action === "ESCALATE") n.priority = "HIGH";
    if (action === "MARK_READ") {
      n.read = true;
      n.read_by = req.user.full_name;
      n.read_at = new Date().toLocaleString();
    }
    updated += 1;
  });
  res.json({ data: { action, updated } });
});

app.post("/api/v1/notifications/retry-failed", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const result = await dbQuery("UPDATE notifications SET delivery_status = 'SENT' WHERE delivery_status = 'FAILED'");
    return res.json({ data: { retried: result.affectedRows || 0 } });
  }
  let retried = 0;
  notifications.forEach((n) => {
    if (n.delivery_status === "FAILED") {
      n.delivery_status = "SENT";
      retried += 1;
    }
  });
  res.json({ data: { retried } });
});

app.get("/api/v1/notifications/preferences", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const row = (await dbQuery("SELECT * FROM notification_preferences ORDER BY id LIMIT 1"))[0];
    if (!row) return res.json({ data: null });
    return res.json({
      data: {
        role: row.role_code,
        channel_in_app: asBool(row.channel_in_app),
        channel_email: asBool(row.channel_email),
        low_stock_threshold: Number(row.low_stock_threshold || 0),
        expiry_window_days: Number(row.expiry_window_days || 0),
        dedup_minutes: Number(row.dedup_minutes || 0),
        suppression_enabled: asBool(row.suppression_enabled)
      }
    });
  }
  res.json({ data: notificationPreferences });
});

app.put("/api/v1/notifications/preferences", authRequired, async (req, res) => {
  if (isMysqlEnabled()) {
    const body = req.body || {};
    const existing = await dbQuery("SELECT id FROM notification_preferences ORDER BY id LIMIT 1");
    if (existing[0]) {
      await dbQuery(
        `UPDATE notification_preferences
         SET role_code = ?, channel_in_app = ?, channel_email = ?, low_stock_threshold = ?, expiry_window_days = ?, dedup_minutes = ?, suppression_enabled = ?
         WHERE id = ?`,
        [
          String(body.role || "ADMIN"),
          body.channel_in_app ? 1 : 0,
          body.channel_email ? 1 : 0,
          toNumber(body.low_stock_threshold, 10),
          toNumber(body.expiry_window_days, 7),
          toNumber(body.dedup_minutes, 30),
          body.suppression_enabled ? 1 : 0,
          existing[0].id
        ]
      );
    } else {
      await dbQuery(
        `INSERT INTO notification_preferences
         (role_code, channel_in_app, channel_email, low_stock_threshold, expiry_window_days, dedup_minutes, suppression_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(body.role || "ADMIN"),
          body.channel_in_app ? 1 : 0,
          body.channel_email ? 1 : 0,
          toNumber(body.low_stock_threshold, 10),
          toNumber(body.expiry_window_days, 7),
          toNumber(body.dedup_minutes, 30),
          body.suppression_enabled ? 1 : 0
        ]
      );
    }
    const row = (await dbQuery("SELECT * FROM notification_preferences ORDER BY id LIMIT 1"))[0];
    return res.json({ data: row });
  }
  Object.assign(notificationPreferences, req.body || {});
  res.json({ data: notificationPreferences });
});

app.get("/api/v1/notifications/rules", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      "SELECT id, rule_code AS rule, severity, channel, active FROM notification_rules ORDER BY id ASC"
    );
    return res.json({ data: rows.map((r) => ({ ...r, active: asBool(r.active) })) });
  }
  res.json({ data: notificationRules });
});

app.patch("/api/v1/notifications/rules/:id/toggle", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const found = await dbQuery("SELECT id, active FROM notification_rules WHERE id = ? LIMIT 1", [id]);
    if (!found[0]) return res.status(404).json({ message: "Rule not found" });
    await dbQuery("UPDATE notification_rules SET active = ? WHERE id = ?", [found[0].active ? 0 : 1, id]);
    const row = (await dbQuery("SELECT id, rule_code AS rule, severity, channel, active FROM notification_rules WHERE id = ?", [id]))[0];
    return res.json({ data: { ...row, active: asBool(row.active) } });
  }
  const rule = notificationRules.find((r) => r.id === id);
  if (!rule) return res.status(404).json({ message: "Rule not found" });
  rule.active = !rule.active;
  res.json({ data: rule });
});

// ===== users =====
app.get("/api/v1/users", authRequired, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT u.id, u.username, u.email, u.full_name, r.code AS role, r.code AS role_name, u.status, u.locked, u.force_reset,
              u.created_by, u.created_at, u.updated_by, u.updated_at, u.last_login
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE (? = '' OR LOWER(u.username) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?)
       ORDER BY u.id ASC`,
      [q, `%${q}%`, `%${q}%`, `%${q}%`]
    );
    return res.json({ data: rows.map((r) => ({ ...r, locked: asBool(r.locked), force_reset: asBool(r.force_reset) })) });
  }
  let rows = [...users];
  if (q) {
    rows = rows.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }
  res.json({ data: rows });
});

app.post("/api/v1/users", authRequired, async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || "").trim();
  const full_name = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !full_name || !email) return res.status(400).json({ message: "username, full_name, and email are required" });
  if (isMysqlEnabled()) {
    const dupUser = await dbQuery("SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1", [username]);
    if (dupUser[0]) return res.status(400).json({ message: "Username already exists" });
    const dupEmail = await dbQuery("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
    if (dupEmail[0]) return res.status(400).json({ message: "Email already exists" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    const role = String(body.role || "CASHIER");
    const roleRow = (await dbQuery("SELECT id FROM roles WHERE code = ? LIMIT 1", [role]))[0];
    if (!roleRow) return res.status(400).json({ message: "Invalid role" });
    const result = await dbQuery(
      `INSERT INTO users
      (username, email, password_hash, full_name, role_id, status, locked, force_reset, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [username, email, password, full_name, roleRow.id, String(body.status || "ACTIVE"), body.force_reset ? 1 : 0, req.user.full_name, req.user.full_name]
    );
    const userId = result.insertId;
    for (const perm of roleTemplates[role] || []) {
      await dbQuery("INSERT INTO user_permissions (user_id, permission_code) VALUES (?, ?)", [userId, perm]);
    }
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'USER_CREATED', ?, NOW())", [userId, username]);
    const row = (
      await dbQuery(
        `SELECT u.id, u.username, u.email, u.full_name, r.code AS role, r.code AS role_name, u.status, u.locked, u.force_reset,
                u.created_by, u.created_at, u.updated_by, u.updated_at, u.last_login
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
        [userId]
      )
    )[0];
    return res.status(201).json({ data: { ...row, locked: asBool(row.locked), force_reset: asBool(row.force_reset) } });
  }
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ message: "Username already exists" });
  if (users.some((u) => u.email.toLowerCase() === email)) return res.status(400).json({ message: "Email already exists" });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  const role = String(body.role || "CASHIER");
  const item = {
    id: ++userIdSeq,
    username,
    email,
    password,
    full_name,
    role,
    role_name: role,
    status: String(body.status || "ACTIVE"),
    locked: false,
    force_reset: Boolean(body.force_reset),
    created_by: req.user.full_name,
    created_at: nowIso(),
    updated_by: req.user.full_name,
    updated_at: nowIso(),
    last_login: "-"
  };
  users.push(item);
  userPermissions[item.id] = [...(roleTemplates[item.role] || [])];
  appendUserActivity("USER_CREATED", item.username);
  res.status(201).json({ data: item });
});

app.put("/api/v1/users/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const existing = await dbQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    if (!existing[0]) return res.status(404).json({ message: "User not found" });
    const body = req.body || {};
    if (body.email) {
      const dupEmail = await dbQuery("SELECT id FROM users WHERE LOWER(email)=LOWER(?) AND id <> ? LIMIT 1", [String(body.email), id]);
      if (dupEmail[0]) return res.status(400).json({ message: "Email already exists" });
    }
    if (body.username) {
      const dupUser = await dbQuery("SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id <> ? LIMIT 1", [String(body.username), id]);
      if (dupUser[0]) return res.status(400).json({ message: "Username already exists" });
    }
    let roleId = existing[0].role_id;
    if (body.role) {
      const roleRow = (await dbQuery("SELECT id FROM roles WHERE code = ? LIMIT 1", [String(body.role)]))[0];
      if (roleRow) roleId = roleRow.id;
    }
    await dbQuery(
      `UPDATE users
       SET username = COALESCE(?, username), email = COALESCE(?, email), full_name = COALESCE(?, full_name),
           role_id = ?, status = COALESCE(?, status), force_reset = COALESCE(?, force_reset), updated_by = ?
       WHERE id = ?`,
      [
        body.username ?? null,
        body.email ?? null,
        body.full_name ?? null,
        roleId,
        body.status ?? null,
        body.force_reset !== undefined ? (body.force_reset ? 1 : 0) : null,
        req.user.full_name,
        id
      ]
    );
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'USER_UPDATED', ?, NOW())", [id, String(body.username || id)]);
    const row = (
      await dbQuery(
        `SELECT u.id, u.username, u.email, u.full_name, r.code AS role, r.code AS role_name, u.status, u.locked, u.force_reset,
                u.created_by, u.created_at, u.updated_by, u.updated_at, u.last_login
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
        [id]
      )
    )[0];
    return res.json({ data: { ...row, locked: asBool(row.locked), force_reset: asBool(row.force_reset) } });
  }
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return res.status(404).json({ message: "User not found" });
  const body = req.body || {};
  if (body.email && users.some((u) => u.id !== id && u.email.toLowerCase() === String(body.email).toLowerCase())) {
    return res.status(400).json({ message: "Email already exists" });
  }
  if (body.username && users.some((u) => u.id !== id && u.username.toLowerCase() === String(body.username).toLowerCase())) {
    return res.status(400).json({ message: "Username already exists" });
  }
  users[idx] = {
    ...users[idx],
    ...body,
    updated_by: req.user.full_name,
    updated_at: nowIso()
  };
  appendUserActivity("USER_UPDATED", users[idx].username);
  res.json({ data: users[idx] });
});

app.delete("/api/v1/users/:id", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    await dbQuery("DELETE FROM users WHERE id = ?", [id]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'USER_DELETED', ?, NOW())", [id, rows[0].username]);
    return res.json({ data: rows[0] });
  }
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return res.status(404).json({ message: "User not found" });
  const [deleted] = users.splice(idx, 1);
  delete userPermissions[id];
  appendUserActivity("USER_DELETED", deleted.username);
  res.json({ data: deleted });
});

app.patch("/api/v1/users/:id/lock-toggle", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT id, username, locked FROM users WHERE id = ? LIMIT 1", [id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    await dbQuery("UPDATE users SET locked = ?, updated_by = ? WHERE id = ?", [user.locked ? 0 : 1, req.user.full_name, id]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'LOCK_TOGGLED', ?, NOW())", [id, user.username]);
    const updated = (await dbQuery("SELECT * FROM users WHERE id = ?", [id]))[0];
    return res.json({ data: { ...updated, locked: asBool(updated.locked), force_reset: asBool(updated.force_reset) } });
  }
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.locked = !user.locked;
  user.updated_by = req.user.full_name;
  user.updated_at = nowIso();
  appendUserActivity("LOCK_TOGGLED", user.username);
  res.json({ data: user });
});

app.patch("/api/v1/users/:id/force-reset", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery("SELECT id, username FROM users WHERE id = ? LIMIT 1", [id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    await dbQuery("UPDATE users SET force_reset = 1, updated_by = ? WHERE id = ?", [req.user.full_name, id]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'FORCE_RESET', ?, NOW())", [id, user.username]);
    const updated = (await dbQuery("SELECT * FROM users WHERE id = ?", [id]))[0];
    return res.json({ data: { ...updated, locked: asBool(updated.locked), force_reset: asBool(updated.force_reset) } });
  }
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.force_reset = true;
  user.updated_by = req.user.full_name;
  user.updated_at = nowIso();
  appendUserActivity("FORCE_RESET", user.username);
  res.json({ data: user });
});

app.get("/api/v1/users/:id/permissions", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const user = (await dbQuery("SELECT id FROM users WHERE id = ? LIMIT 1", [id]))[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    const rows = await dbQuery("SELECT permission_code FROM user_permissions WHERE user_id = ? ORDER BY permission_code", [id]);
    return res.json({ data: rows.map((r) => r.permission_code) });
  }
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ data: userPermissions[id] || roleTemplates[user.role] || [] });
});

app.put("/api/v1/users/:id/permissions", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const user = (await dbQuery("SELECT id, username FROM users WHERE id = ? LIMIT 1", [id]))[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    const perms = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    await dbQuery("DELETE FROM user_permissions WHERE user_id = ?", [id]);
    for (const p of perms) await dbQuery("INSERT INTO user_permissions (user_id, permission_code) VALUES (?, ?)", [id, p]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'PERMISSIONS_UPDATED', ?, NOW())", [id, user.username]);
    return res.json({ data: perms });
  }
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ message: "User not found" });
  userPermissions[id] = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  appendUserActivity("PERMISSIONS_UPDATED", user.username);
  res.json({ data: userPermissions[id] });
});

app.get("/api/v1/users/sessions", authRequired, async (req, res) => {
  const userId = toNumber(req.query.user_id, -1);
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      `SELECT id, user_id, device, ip, started_at, active
       FROM user_sessions
       WHERE (? <= 0 OR user_id = ?)
       ORDER BY id DESC`,
      [userId, userId]
    );
    return res.json({ data: rows.map((r) => ({ ...r, active: asBool(r.active) })) });
  }
  const rows = userId > 0 ? sessions.filter((s) => s.user_id === userId) : sessions;
  res.json({ data: rows });
});

app.post("/api/v1/users/:id/sessions/revoke", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const result = await dbQuery("UPDATE user_sessions SET active = 0 WHERE user_id = ? AND active = 1", [id]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'SESSIONS_REVOKED', ?, NOW())", [id, `user:${id}`]);
    return res.json({ data: { revoked: result.affectedRows || 0 } });
  }
  let updated = 0;
  sessions.forEach((s) => {
    if (s.user_id === id && s.active) {
      s.active = false;
      updated += 1;
    }
  });
  appendUserActivity("SESSIONS_REVOKED", `user:${id}`);
  res.json({ data: { revoked: updated } });
});

app.post("/api/v1/users/:id/logout-all", authRequired, async (req, res) => {
  const id = toNumber(req.params.id, -1);
  if (isMysqlEnabled()) {
    const result = await dbQuery("UPDATE user_sessions SET active = 0 WHERE user_id = ? AND active = 1", [id]);
    await dbQuery("UPDATE auth_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [id]);
    await dbQuery("INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'LOGOUT_ALL_DEVICES', ?, NOW())", [id, `user:${id}`]);
    return res.json({ data: { logged_out: result.affectedRows || 0 } });
  }
  let updated = 0;
  sessions.forEach((s) => {
    if (s.user_id === id && s.active) {
      s.active = false;
      updated += 1;
    }
  });
  appendUserActivity("LOGOUT_ALL_DEVICES", `user:${id}`);
  res.json({ data: { logged_out: updated } });
});

app.get("/api/v1/users/activity", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const rows = await dbQuery(
      "SELECT id, created_at AS time, action, detail FROM user_activity_logs ORDER BY id DESC LIMIT 200"
    );
    return res.json({ data: rows });
  }
  res.json({ data: userActivity });
});

// ===== email settings =====
app.get("/api/v1/email-settings", authRequired, async (_req, res) => {
  if (isMysqlEnabled()) {
    const row = (await dbQuery("SELECT * FROM email_settings ORDER BY id LIMIT 1"))[0];
    if (!row) return res.json({ data: null });
    const recipients = await dbQuery(
      "SELECT recipient_email FROM email_recipients WHERE email_setting_id = ? ORDER BY id ASC",
      [row.id]
    );
    return res.json({
      data: {
        smtp_host: row.smtp_host,
        smtp_port: Number(row.smtp_port || 0),
        smtp_user: row.smtp_user,
        smtp_password: row.smtp_password,
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        use_tls: asBool(row.use_tls) ? 1 : 0,
        alert_expiry_days: Number(row.alert_expiry_days || 0),
        alert_low_stock_enabled: asBool(row.alert_low_stock_enabled) ? 1 : 0,
        alert_expiry_enabled: asBool(row.alert_expiry_enabled) ? 1 : 0,
        alert_recipients: recipients.map((r) => r.recipient_email)
      }
    });
  }
  res.json({ data: emailSettings });
});

app.put("/api/v1/email-settings", authRequired, async (req, res) => {
  if (isMysqlEnabled()) {
    const body = req.body || {};
    const rows = await dbQuery("SELECT id FROM email_settings ORDER BY id LIMIT 1");
    let settingId = rows[0]?.id;
    if (!settingId) {
      const ins = await dbQuery(
        `INSERT INTO email_settings
        (smtp_host, smtp_port, smtp_user, smtp_password, sender_name, sender_email, use_tls, alert_expiry_days, alert_low_stock_enabled, alert_expiry_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(body.smtp_host || ""),
          toNumber(body.smtp_port, 587),
          String(body.smtp_user || ""),
          String(body.smtp_password || ""),
          String(body.sender_name || "AI Inventory"),
          String(body.sender_email || ""),
          body.use_tls ? 1 : 0,
          toNumber(body.alert_expiry_days, 7),
          body.alert_low_stock_enabled ? 1 : 0,
          body.alert_expiry_enabled ? 1 : 0
        ]
      );
      settingId = ins.insertId;
    } else {
      await dbQuery(
        `UPDATE email_settings
         SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_password = ?, sender_name = ?, sender_email = ?, use_tls = ?,
             alert_expiry_days = ?, alert_low_stock_enabled = ?, alert_expiry_enabled = ?
         WHERE id = ?`,
        [
          String(body.smtp_host || ""),
          toNumber(body.smtp_port, 587),
          String(body.smtp_user || ""),
          String(body.smtp_password || ""),
          String(body.sender_name || "AI Inventory"),
          String(body.sender_email || ""),
          body.use_tls ? 1 : 0,
          toNumber(body.alert_expiry_days, 7),
          body.alert_low_stock_enabled ? 1 : 0,
          body.alert_expiry_enabled ? 1 : 0,
          settingId
        ]
      );
    }
    await dbQuery("DELETE FROM email_recipients WHERE email_setting_id = ?", [settingId]);
    const recipients = Array.isArray(body.alert_recipients) ? body.alert_recipients.slice(0, 5) : [];
    for (const e of recipients.map((x) => String(x || "").trim()).filter(Boolean)) {
      await dbQuery("INSERT INTO email_recipients (email_setting_id, recipient_email) VALUES (?, ?)", [settingId, e]);
    }
    const row = (await dbQuery("SELECT * FROM email_settings WHERE id = ?", [settingId]))[0];
    return res.json({ data: { ...row, alert_recipients: recipients } });
  }
  const body = req.body || {};
  Object.assign(emailSettings, body);
  if (!Array.isArray(emailSettings.alert_recipients)) emailSettings.alert_recipients = [""];
  emailSettings.alert_recipients = emailSettings.alert_recipients.slice(0, 5);
  res.json({ data: emailSettings });
});

app.post("/api/v1/email-settings/test", authRequired, async (req, res) => {
  const to = Array.isArray(req.body?.to)
    ? req.body.to.filter(Boolean)
    : String(req.body?.to || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  if (isMysqlEnabled() && !to.length) {
    const row = (await dbQuery("SELECT id FROM email_settings ORDER BY id LIMIT 1"))[0];
    if (row) {
      const recipients = await dbQuery("SELECT recipient_email FROM email_recipients WHERE email_setting_id = ?", [row.id]);
      return res.json({
        data: {
          ok: true,
          to: recipients.map((r) => r.recipient_email),
          sent_at: nowIso()
        }
      });
    }
  }
  res.json({
    data: {
      ok: true,
      to: to.length ? to : emailSettings.alert_recipients.filter(Boolean),
      sent_at: nowIso()
    }
  });
});

app.get("/", async (req, res) => {
  const summary = await getBackendStatusSummary(req);
  res.type("html").send(renderBackendPage(summary));
});

app.get("/health", (_req, res) => {
  res.redirect(302, "/api/v1/health");
});

app.get("/login", (_req, res) => {
  if (FRONTEND_URL) return res.redirect(302, `${FRONTEND_URL}/login`);
  return res.redirect(302, "/");
});

app.get("/dashboard.html", (_req, res) => {
  res.redirect(302, "/");
});

app.get("/login.html", (_req, res) => {
  if (FRONTEND_URL) return res.redirect(302, `${FRONTEND_URL}/login`);
  return res.redirect(302, "/");
});

app.get(/\/[^/]+\.html$/, (_req, res) => {
  res.redirect(302, "/");
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow:");
});

// ===== fallback =====
app.use("/api/v1", authRequired, (_req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running at http://127.0.0.1:${PORT}`);
});
