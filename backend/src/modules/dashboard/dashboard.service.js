import { pool } from "../../db/pool.js";

export async function getDashboardSummary() {
  const [[productsRow]] = await pool.query(
    `SELECT COUNT(*) AS total_products
     FROM products
     WHERE deleted_at IS NULL`
  );

  const [[salesTodayRow]] = await pool.query(
    `SELECT COALESCE(SUM(grand_total), 0) AS total_sales_today
     FROM sales
     WHERE deleted_at IS NULL
       AND DATE(sale_datetime) = CURDATE()`
  );

  const [[monthlyRevenueRow]] = await pool.query(
    `SELECT COALESCE(SUM(grand_total), 0) AS monthly_revenue
     FROM sales
     WHERE deleted_at IS NULL
       AND YEAR(sale_datetime) = YEAR(CURDATE())
       AND MONTH(sale_datetime) = MONTH(CURDATE())`
  );

  const [[lowStockRow]] = await pool.query(
    `SELECT COUNT(*) AS low_stock_count
     FROM products
     WHERE deleted_at IS NULL
       AND quantity <= min_stock_level`
  );

  const [[expiryDaysRow]] = await pool.query(
    `SELECT COALESCE(MAX(alert_expiry_days), 7) AS alert_expiry_days
     FROM email_settings
     WHERE deleted_at IS NULL`
  );

  const alertDays = Number(expiryDaysRow.alert_expiry_days || 7);

  const [[expiringSoonRow]] = await pool.query(
    `SELECT COUNT(*) AS expiring_soon_count
     FROM products
     WHERE deleted_at IS NULL
       AND expiry_date IS NOT NULL
       AND expiry_date >= CURDATE()
       AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [alertDays]
  );

  return {
    total_products: Number(productsRow.total_products || 0),
    total_sales_today: Number(salesTodayRow.total_sales_today || 0).toFixed(2),
    monthly_revenue: Number(monthlyRevenueRow.monthly_revenue || 0).toFixed(2),
    low_stock_count: Number(lowStockRow.low_stock_count || 0),
    expiring_soon_count: Number(expiringSoonRow.expiring_soon_count || 0)
  };
}

export async function getDashboardAnalytics() {
  const [dailySalesRows] = await pool.query(
    `SELECT DATE(s.sale_datetime) AS sale_date,
            COALESCE(SUM(si.line_total), 0) AS total_sales
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.sale_id
     WHERE s.deleted_at IS NULL
       AND si.deleted_at IS NULL
       AND DATE(s.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
     GROUP BY DATE(s.sale_datetime)
     ORDER BY sale_date ASC`
  );

  const [topProductsRows] = await pool.query(
    `SELECT p.product_id, p.product_name,
            COALESCE(SUM(si.quantity_sold), 0) AS total_units,
            COALESCE(SUM(si.line_total), 0) AS total_sales
     FROM sale_items si
     JOIN sales s ON s.sale_id = si.sale_id
     JOIN products p ON p.product_id = si.product_id
     WHERE s.deleted_at IS NULL
       AND si.deleted_at IS NULL
     GROUP BY p.product_id, p.product_name
     ORDER BY total_units DESC, total_sales DESC
     LIMIT 5`
  );

  const [categoryRows] = await pool.query(
    `SELECT c.category_name,
            COALESCE(SUM(si.line_total), 0) AS total_sales
     FROM sale_items si
     JOIN sales s ON s.sale_id = si.sale_id
     JOIN products p ON p.product_id = si.product_id
     JOIN categories c ON c.category_id = p.category_id
     WHERE s.deleted_at IS NULL
       AND si.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND c.deleted_at IS NULL
     GROUP BY c.category_name
     ORDER BY total_sales DESC
     LIMIT 6`
  );

  const [lowStockRows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.barcode, p.quantity, p.min_stock_level
     FROM products p
     WHERE p.deleted_at IS NULL
       AND p.quantity <= p.min_stock_level
     ORDER BY p.quantity ASC, p.product_id ASC
     LIMIT 8`
  );

  return {
    daily_sales: dailySalesRows.map((r) => ({
      sale_date: r.sale_date,
      total_sales: Number(r.total_sales || 0)
    })),
    top_products: topProductsRows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      total_units: Number(r.total_units || 0),
      total_sales: Number(r.total_sales || 0)
    })),
    category_sales: categoryRows.map((r) => ({
      category_name: r.category_name,
      total_sales: Number(r.total_sales || 0)
    })),
    low_stock_items: lowStockRows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      barcode: r.barcode,
      quantity: Number(r.quantity || 0),
      min_stock_level: Number(r.min_stock_level || 0)
    }))
  };
}
