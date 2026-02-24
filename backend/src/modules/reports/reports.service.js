import { pool } from "../../db/pool.js";
import { getReorderRecommendations } from "../ai/ai.service.js";

export async function salesDailyReport(dateFrom, dateTo) {
  const filters = ["s.deleted_at IS NULL", "si.deleted_at IS NULL"];
  const params = [];

  if (dateFrom) {
    filters.push("DATE(s.sale_datetime) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(s.sale_datetime) <= ?");
    params.push(dateTo);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT DATE(s.sale_datetime) AS sale_date,
            COUNT(DISTINCT s.sale_id) AS total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) AS total_units_sold,
            COALESCE(SUM(si.line_total), 0) AS total_sales_amount
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.sale_id
     WHERE ${whereClause}
     GROUP BY DATE(s.sale_datetime)
     ORDER BY sale_date DESC`,
    params
  );

  return rows;
}

export async function salesMonthlyReport(dateFrom, dateTo) {
  const filters = ["s.deleted_at IS NULL", "si.deleted_at IS NULL"];
  const params = [];

  if (dateFrom) {
    filters.push("DATE(s.sale_datetime) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("DATE(s.sale_datetime) <= ?");
    params.push(dateTo);
  }

  const whereClause = filters.join(" AND ");

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(s.sale_datetime, '%Y-%m') AS sale_month,
            COUNT(DISTINCT s.sale_id) AS total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) AS total_units_sold,
            COALESCE(SUM(si.line_total), 0) AS total_sales_amount
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.sale_id
     WHERE ${whereClause}
     GROUP BY DATE_FORMAT(s.sale_datetime, '%Y-%m')
     ORDER BY sale_month DESC`,
    params
  );

  return rows;
}

export async function stockLowReport() {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode,
            p.quantity, p.min_stock_level,
            c.category_name
     FROM products p
     JOIN categories c ON c.category_id = p.category_id
     WHERE p.deleted_at IS NULL
       AND p.quantity <= p.min_stock_level
     ORDER BY p.quantity ASC, p.product_id ASC`
  );

  return rows;
}

export async function stockExpiryReport() {
  const [[settingsRow]] = await pool.query(
    `SELECT COALESCE(MAX(alert_expiry_days), 7) AS alert_expiry_days
     FROM email_settings
     WHERE deleted_at IS NULL`
  );

  const days = Number(settingsRow.alert_expiry_days || 7);

  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode,
            p.quantity, p.expiry_date,
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

export async function aiReorderSuggestionsReport(days, leadTime) {
  const rows = await getReorderRecommendations(days, leadTime);
  return rows;
}
