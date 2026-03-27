import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMysqlPool, isMysqlEnabled } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.resolve(__dirname, "../docs");
const outputJson = path.join(docsDir, "thesis-evaluation.json");
const outputMd = path.join(docsDir, "thesis-evaluation.md");

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 16).replace("T", " ");
}

async function queryOne(pool, sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || {};
}

async function queryAll(pool, sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function buildEvaluation() {
  if (!isMysqlEnabled()) {
    throw new Error("PostgreSQL is not configured for evaluation");
  }

  const pool = getMysqlPool();
  if (!pool) {
    throw new Error("PostgreSQL pool is not available");
  }

  const system = await queryOne(
    pool,
    `SELECT
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM products WHERE status = 'ACTIVE') AS active_products,
        (SELECT COUNT(*) FROM products WHERE quantity < min_stock_level) AS low_stock_products,
        (SELECT COUNT(*) FROM products WHERE expiry_date IS NOT NULL AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_products,
        (SELECT COUNT(*) FROM categories) AS total_categories,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE') AS active_users,
        (SELECT COUNT(*) FROM notifications) AS total_notifications,
        (SELECT COUNT(*) FROM notifications WHERE is_read = FALSE) AS unread_notifications,
        (SELECT COUNT(*) FROM report_runs) AS report_runs,
        (SELECT COUNT(*) FROM report_schedules WHERE active = TRUE) AS active_report_schedules`
  );

  const sales = await queryOne(
    pool,
    `SELECT
        COUNT(*) AS total_transactions,
        ROUND(COALESCE(SUM(total), 0), 2) AS total_revenue,
        ROUND(COALESCE(AVG(total), 0), 2) AS average_transaction,
        MIN(sale_time) AS first_sale_at,
        MAX(sale_time) AS last_sale_at
     FROM sales
     WHERE is_refund = FALSE`
  );

  const saleItems = await queryOne(
    pool,
    `SELECT ROUND(COALESCE(SUM(qty), 0), 2) AS total_units_sold
     FROM sale_items`
  );

  const reports = await queryAll(
    pool,
    `SELECT report_type, COUNT(*) AS runs
     FROM report_runs
     GROUP BY report_type
     ORDER BY runs DESC, report_type ASC`
  );

  const ai = await queryOne(
    pool,
    `SELECT
        COUNT(*) AS forecast_runs,
        COUNT(DISTINCT product_id) AS forecasted_products,
        ROUND(COALESCE(AVG(mae), 0), 2) AS avg_mae,
        ROUND(COALESCE(AVG(mape), 0), 2) AS avg_mape,
        ROUND(COALESCE(AVG(rmse), 0), 2) AS avg_rmse,
        MAX(created_at) AS last_forecast_at
     FROM ai_forecast_runs
     WHERE selected_model = 'PROPHET'`
  );

  const lowStockSample = await queryAll(
    pool,
    `SELECT product_name, quantity, min_stock_level
     FROM products
     WHERE quantity < min_stock_level
     ORDER BY (min_stock_level - quantity) DESC, product_name ASC
     LIMIT 5`
  );

  const evaluation = {
    generated_at: new Date().toISOString(),
    database: process.env.DATABASE_URL || "ai_inventory",
    system: {
      total_products: toNumber(system.total_products),
      active_products: toNumber(system.active_products),
      low_stock_products: toNumber(system.low_stock_products),
      expiring_products_30d: toNumber(system.expiring_products),
      total_categories: toNumber(system.total_categories),
      total_users: toNumber(system.total_users),
      active_users: toNumber(system.active_users),
      total_notifications: toNumber(system.total_notifications),
      unread_notifications: toNumber(system.unread_notifications),
      report_runs: toNumber(system.report_runs),
      active_report_schedules: toNumber(system.active_report_schedules)
    },
    sales: {
      total_transactions: toNumber(sales.total_transactions),
      total_units_sold: toNumber(saleItems.total_units_sold),
      total_revenue: toNumber(sales.total_revenue),
      average_transaction: toNumber(sales.average_transaction),
      first_sale_at: formatDateTime(sales.first_sale_at),
      last_sale_at: formatDateTime(sales.last_sale_at)
    },
    ai_forecast: {
      model: "PROPHET",
      forecast_runs: toNumber(ai.forecast_runs),
      forecasted_products: toNumber(ai.forecasted_products),
      average_mae: toNumber(ai.avg_mae),
      average_mape: toNumber(ai.avg_mape),
      average_rmse: toNumber(ai.avg_rmse),
      last_forecast_at: formatDateTime(ai.last_forecast_at)
    },
    reports: reports.map((row) => ({
      report_type: row.report_type,
      runs: toNumber(row.runs)
    })),
    low_stock_sample: lowStockSample.map((row) => ({
      product_name: row.product_name,
      quantity: toNumber(row.quantity),
      min_stock_level: toNumber(row.min_stock_level)
    }))
  };

  return evaluation;
}

function toMarkdown(data) {
  const reportLines = data.reports.length
    ? data.reports.map((row) => `| ${row.report_type} | ${row.runs} |`).join("\n")
    : "| - | 0 |";

  const lowStockLines = data.low_stock_sample.length
    ? data.low_stock_sample.map((row) => `| ${row.product_name} | ${row.quantity} | ${row.min_stock_level} |`).join("\n")
    : "| - | 0 | 0 |";

  return `# Thesis Evaluation Summary

Generated at: ${data.generated_at}
Database: ${data.database}

## System Coverage

| Metric | Value |
| --- | ---: |
| Total Products | ${data.system.total_products} |
| Active Products | ${data.system.active_products} |
| Low Stock Products | ${data.system.low_stock_products} |
| Expiring Products (30d) | ${data.system.expiring_products_30d} |
| Total Categories | ${data.system.total_categories} |
| Total Users | ${data.system.total_users} |
| Active Users | ${data.system.active_users} |
| Total Notifications | ${data.system.total_notifications} |
| Unread Notifications | ${data.system.unread_notifications} |
| Report Runs | ${data.system.report_runs} |
| Active Report Schedules | ${data.system.active_report_schedules} |

## Sales Summary

| Metric | Value |
| --- | ---: |
| Total Transactions | ${data.sales.total_transactions} |
| Total Units Sold | ${data.sales.total_units_sold} |
| Total Revenue | ${data.sales.total_revenue} |
| Average Transaction | ${data.sales.average_transaction} |
| First Sale | ${data.sales.first_sale_at} |
| Last Sale | ${data.sales.last_sale_at} |

## AI Forecast Evaluation

| Metric | Value |
| --- | ---: |
| Model | ${data.ai_forecast.model} |
| Forecast Runs | ${data.ai_forecast.forecast_runs} |
| Forecasted Products | ${data.ai_forecast.forecasted_products} |
| Average MAE | ${data.ai_forecast.average_mae} |
| Average MAPE | ${data.ai_forecast.average_mape} |
| Average RMSE | ${data.ai_forecast.average_rmse} |
| Last Forecast | ${data.ai_forecast.last_forecast_at} |

## Report Activity

| Report Type | Runs |
| --- | ---: |
${reportLines}

## Low Stock Sample

| Product | Quantity | Min Stock |
| --- | ---: | ---: |
${lowStockLines}
`;
}

async function main() {
  const evaluation = await buildEvaluation();
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(outputJson, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
  await fs.writeFile(outputMd, `${toMarkdown(evaluation)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Evaluation written to ${outputJson}`);
  // eslint-disable-next-line no-console
  console.log(`Evaluation written to ${outputMd}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`Evaluation failed: ${err.message}`);
  process.exitCode = 1;
});
