import { pool } from "../../db/pool.js";

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function buildForecast(product, totalUnits, days, leadTime) {
  const averageDailySales = Number(totalUnits || 0) / days;
  const reorderLevel = averageDailySales * leadTime;
  const currentStock = Number(product.current_stock || 0);
  const suggestedPurchaseQty = Math.max(Math.ceil(reorderLevel - currentStock), 0);

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    average_daily_sales: Number(averageDailySales.toFixed(2)),
    lead_time_days: leadTime,
    reorder_level: Number(reorderLevel.toFixed(2)),
    current_stock: currentStock,
    suggested_purchase_qty: suggestedPurchaseQty,
    analysis_days: days
  };
}

export async function getForecastByProduct(productId, daysInput, leadTimeInput) {
  const days = toPositiveInt(daysInput, 30);
  const leadTime = toPositiveInt(leadTimeInput, 7);

  const [productRows] = await pool.query(
    `SELECT product_id, product_name, quantity AS current_stock
     FROM products
     WHERE product_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [productId]
  );

  const product = productRows[0];
  if (!product) return null;

  const [[salesRow]] = await pool.query(
    `SELECT COALESCE(SUM(si.quantity_sold), 0) AS total_units
     FROM sale_items si
     JOIN sales s ON s.sale_id = si.sale_id
     WHERE si.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND si.product_id = ?
       AND DATE(s.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [productId, days]
  );

  return buildForecast(product, Number(salesRow.total_units || 0), days, leadTime);
}

export async function getReorderRecommendations(daysInput, leadTimeInput) {
  const days = toPositiveInt(daysInput, 30);
  const leadTime = toPositiveInt(leadTimeInput, 7);

  const [rows] = await pool.query(
    `SELECT p.product_id, p.product_name, p.quantity AS current_stock,
            COALESCE(sales_units.total_units, 0) AS total_units
     FROM products p
     LEFT JOIN (
       SELECT si.product_id, SUM(si.quantity_sold) AS total_units
       FROM sale_items si
       JOIN sales s ON s.sale_id = si.sale_id
       WHERE si.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND DATE(s.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY si.product_id
     ) sales_units ON sales_units.product_id = p.product_id
     WHERE p.deleted_at IS NULL
     ORDER BY p.product_id ASC`,
    [days]
  );

  const recommendations = rows
    .map((row) => buildForecast(row, Number(row.total_units || 0), days, leadTime))
    .filter((x) => x.suggested_purchase_qty > 0)
    .sort((a, b) => b.suggested_purchase_qty - a.suggested_purchase_qty);

  return recommendations;
}
