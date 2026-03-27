BEGIN;

TRUNCATE TABLE
  email_recipients,
  email_settings,
  notification_rules,
  notification_preferences,
  notifications,
  ai_forecast_versions,
  ai_forecast_runs,
  ai_model_performance,
  report_schedules,
  report_runs,
  shift_closures,
  sale_items,
  sales,
  inventory_movements,
  stock_lots,
  products,
  categories,
  auth_tokens,
  user_activity_logs,
  user_sessions,
  user_permissions,
  users,
  roles
RESTART IDENTITY CASCADE;

INSERT INTO roles (code, name) VALUES
('ADMINISTRATOR', 'Administrator'),
('CASHIER', 'Cashier');

INSERT INTO users (username, email, password_hash, full_name, role_id, status, created_by, updated_by, last_login) VALUES
('admin', 'admin@example.com', '$2b$10$demo.hash.admin', 'Demo Admin', 1, 'ACTIVE', 'System', 'System', NOW()),
('cashier1', 'cashier@example.com', '$2b$10$demo.hash.cashier', 'Demo Cashier', 2, 'ACTIVE', 'Demo Admin', 'Manager A', NOW());

INSERT INTO user_permissions (user_id, permission_code) VALUES
(1, 'dashboard.view'),
(1, 'products.manage'),
(1, 'sales.manage'),
(1, 'reports.view'),
(1, 'ai.manage'),
(1, 'inventory.manage'),
(1, 'categories.manage'),
(1, 'users.manage'),
(1, 'email.manage'),
(2, 'dashboard.view'),
(2, 'products.view'),
(2, 'sales.create'),
(2, 'sales.refund'),
(2, 'reports.view');

INSERT INTO user_sessions (user_id, device, ip, active) VALUES
(1, 'MacBook Pro', '103.1.2.3', TRUE),
(2, 'Windows POS', '10.0.0.12', TRUE);

INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES
(1, 'demo-token-hash-admin', NOW() + INTERVAL '30 days'),
(2, 'demo-token-hash-cashier', NOW() + INTERVAL '30 days');

INSERT INTO categories (name_en, name_km, description, status, created_by, updated_by) VALUES
('Drink', 'ភេសជ្ជៈ', 'Beverages and bottled items', 'ACTIVE', 'Demo Admin', 'Demo Admin'),
('Food', 'អាហារ', 'General food products', 'ACTIVE', 'Demo Admin', 'Manager A');

INSERT INTO products
(product_name, barcode, category_id, quantity, cost_price, selling_price, min_stock_level, supplier, expiry_date, status, monthly_sales, store_code)
VALUES
('Coca Cola 330ml', '8850001', 1, 14, 0.55, 0.75, 10, 'Coca Distributor', '2026-03-30', 'ACTIVE', 84, 'MAIN'),
('Instant Noodle', '8850002', 2, 5, 0.30, 0.45, 12, 'Noodle Trading', '2026-08-15', 'ACTIVE', 96, 'MAIN'),
('UHT Milk', '8850003', 2, 8, 0.95, 1.20, 10, 'Dairy KH', '2026-03-12', 'ACTIVE', 41, 'MAIN'),
('Hand Soap', '8850011', 2, 2, 0.90, 1.40, 8, 'Clean Plus', NULL, 'ACTIVE', 18, 'MAIN'),
('Orange Juice 1L', '8850012', 1, 11, 1.10, 1.55, 9, 'Fresh Drink Co', '2026-06-20', 'ACTIVE', 52, 'MAIN'),
('Jasmine Rice 5kg', '8850013', 2, 18, 4.80, 5.90, 7, 'Golden Rice Supply', '2027-01-15', 'ACTIVE', 28, 'MAIN');

INSERT INTO stock_lots (product_id, lot_no, qty, expiry_date, supplier, store_code) VALUES
(3, 'MILK-A12', 4, '2026-03-10', 'Dairy KH', 'MAIN'),
(3, 'MILK-B07', 4, '2026-03-18', 'Dairy KH', 'MAIN'),
(2, 'NDL-C33', 5, '2026-08-15', 'Noodle Trading', 'MAIN'),
(5, 'ORG-A09', 6, '2026-06-20', 'Fresh Drink Co', 'MAIN'),
(6, 'RICE-B21', 10, '2027-01-15', 'Golden Rice Supply', 'MAIN');

INSERT INTO sales
(sale_code, sale_time, payment_method, customer_name, customer_phone, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, khr_rate, total_khr, paid_amount, change_amount, sync_status, is_refund, created_by)
VALUES
('S20260213', NOW() - INTERVAL '28 days', 'CASH', 'Walk-in', '-', 3.90, 0, 0, 0, 0, 3.90, 4100, 15990, 4.00, 0.10, 'SYNCED', FALSE, 'Demo Admin'),
('S20260215', NOW() - INTERVAL '26 days', 'BANK_TRANSFER', 'Walk-in', '-', 3.45, 0, 0, 0, 0, 3.45, 4100, 14145, 3.45, 0.00, 'SYNCED', FALSE, 'Demo Admin'),
('S20260217', NOW() - INTERVAL '24 days', 'CASH', 'Walk-in', '-', 4.80, 0, 0, 0, 0, 4.80, 4100, 19680, 5.00, 0.20, 'SYNCED', FALSE, 'Demo Admin'),
('S20260219', NOW() - INTERVAL '22 days', 'CASH', 'Walk-in', '-', 2.55, 0, 0, 0, 0, 2.55, 4100, 10455, 3.00, 0.45, 'SYNCED', FALSE, 'Demo Admin'),
('S20260221', NOW() - INTERVAL '20 days', 'BANK_TRANSFER', 'Walk-in', '-', 5.10, 0, 0, 0, 0, 5.10, 4100, 20910, 5.10, 0.00, 'SYNCED', FALSE, 'Demo Admin'),
('S20260223', NOW() - INTERVAL '18 days', 'CASH', 'Walk-in', '-', 3.60, 0, 0, 0, 0, 3.60, 4100, 14760, 4.00, 0.40, 'SYNCED', FALSE, 'Demo Admin'),
('S20260225', NOW() - INTERVAL '16 days', 'CASH', 'Walk-in', '-', 4.20, 0, 0, 0, 0, 4.20, 4100, 17220, 5.00, 0.80, 'SYNCED', FALSE, 'Demo Admin'),
('S20260227', NOW() - INTERVAL '14 days', 'BANK_TRANSFER', 'Walk-in', '-', 6.00, 0, 0, 0, 0, 6.00, 4100, 24600, 6.00, 0.00, 'SYNCED', FALSE, 'Demo Admin'),
('S20260301', NOW() - INTERVAL '12 days', 'CASH', 'Walk-in', '-', 6.35, 0, 0, 0, 0, 6.35, 4100, 26035, 7.00, 0.65, 'SYNCED', FALSE, 'Demo Admin'),
('S20260303', NOW() - INTERVAL '10 days', 'BANK_TRANSFER', 'Walk-in', '-', 7.00, 0, 0, 0, 0, 7.00, 4100, 28700, 7.00, 0.00, 'SYNCED', FALSE, 'Demo Admin'),
('S20260305', NOW() - INTERVAL '8 days', 'CASH', 'Walk-in', '-', 8.15, 0, 0, 0, 0, 8.15, 4100, 33415, 8.50, 0.35, 'SYNCED', FALSE, 'Demo Admin'),
('S20260307', NOW() - INTERVAL '6 days', 'CASH', 'Walk-in', '-', 7.25, 0, 0, 0, 0, 7.25, 4100, 29725, 8.00, 0.75, 'SYNCED', FALSE, 'Demo Admin');

INSERT INTO sale_items (sale_id, product_id, qty, unit_price, cost_price, line_total) VALUES
(1, 1, 4, 0.75, 0.55, 3.00),
(1, 2, 2, 0.45, 0.30, 0.90),
(2, 1, 3, 0.75, 0.55, 2.25),
(2, 3, 1, 1.20, 0.95, 1.20),
(3, 1, 4, 0.75, 0.55, 3.00),
(3, 2, 4, 0.45, 0.30, 1.80),
(4, 2, 3, 0.45, 0.30, 1.35),
(4, 4, 1, 1.40, 0.90, 1.40),
(5, 1, 4, 0.75, 0.55, 3.00),
(5, 3, 1, 1.20, 0.95, 1.20),
(5, 2, 2, 0.45, 0.30, 0.90),
(6, 2, 4, 0.45, 0.30, 1.80),
(6, 1, 2, 0.75, 0.55, 1.50),
(6, 4, 1, 1.40, 0.90, 1.40),
(7, 1, 4, 0.75, 0.55, 3.00),
(7, 2, 2, 0.45, 0.30, 0.90),
(7, 3, 1, 1.20, 0.95, 1.20),
(8, 1, 4, 0.75, 0.55, 3.00),
(8, 2, 4, 0.45, 0.30, 1.80),
(8, 3, 1, 1.20, 0.95, 1.20),
(9, 5, 2, 1.55, 1.10, 3.10),
(9, 1, 2, 0.75, 0.55, 1.50),
(9, 2, 3, 0.45, 0.30, 1.35),
(10, 6, 1, 5.90, 4.80, 5.90),
(10, 3, 1, 1.20, 0.95, 1.20),
(11, 5, 3, 1.55, 1.10, 4.65),
(11, 1, 2, 0.75, 0.55, 1.50),
(11, 2, 3, 0.45, 0.30, 1.35),
(12, 6, 1, 5.90, 4.80, 5.90),
(12, 5, 1, 1.55, 1.10, 1.55);

INSERT INTO notification_rules (rule_code, severity, channel, active) VALUES
('LOW_STOCK', 'HIGH', 'IN_APP + EMAIL', TRUE),
('CRITICAL_STOCK', 'CRITICAL', 'IN_APP + EMAIL', TRUE),
('EXPIRY_30D', 'MEDIUM', 'IN_APP', TRUE),
('EXPIRY_7D', 'HIGH', 'IN_APP + EMAIL', TRUE),
('REORDER_AI', 'MEDIUM', 'IN_APP', TRUE);

INSERT INTO notification_preferences
(role_code, channel_in_app, channel_email, low_stock_threshold, expiry_window_days, dedup_minutes, suppression_enabled)
VALUES
('ADMIN', TRUE, TRUE, 12, 7, 30, TRUE);

INSERT INTO notifications
(notification_type, priority, product_id, message, channel, delivery_status, is_read, acknowledged, source_link, read_by, read_at)
VALUES
('LOW_STOCK', 'HIGH', 2, 'Stock is below minimum threshold (5/12).', 'IN_APP + EMAIL', 'SENT', FALSE, FALSE, '/inventory-health', NULL, NULL),
('EXPIRY_7D', 'HIGH', 3, 'Product expires within 7 days.', 'IN_APP + EMAIL', 'FAILED', FALSE, FALSE, '/inventory-health', NULL, NULL),
('REORDER_AI', 'MEDIUM', 1, 'AI recommends reorder quantity +26.', 'IN_APP', 'SENT', TRUE, TRUE, '/ai', 1, NOW());

INSERT INTO ai_model_performance
(category_name, prophet_mape, arima_mape, prophet_mae, arima_mae, prophet_rmse, arima_rmse, selected_model)
VALUES
('Beverages', 12.80, 14.50, 3.10, 3.70, 4.80, 5.20, 'PROPHET'),
('Snacks', 15.20, 13.90, 3.80, 3.50, 5.60, 5.00, 'ARIMA'),
('Rice & Grains', 10.50, 11.20, 2.50, 2.80, 3.90, 4.20, 'PROPHET');

INSERT INTO ai_forecast_runs
(product_id, horizon_days, selected_model, mae, mape, rmse, avg_daily_demand, forecast_total, reorder_level, ci_low, ci_high, created_at)
VALUES
(1, 30, 'PROPHET', 3.10, 13.40, 4.80, 2.90, 87.00, 104.40, 78.00, 96.00, NOW() - INTERVAL '4 days'),
(2, 30, 'PROPHET', 3.80, 14.10, 5.60, 3.20, 96.00, 115.20, 86.00, 108.00, NOW() - INTERVAL '3 days'),
(3, 30, 'PROPHET', 2.90, 11.80, 4.10, 1.35, 40.50, 48.60, 35.00, 46.00, NOW() - INTERVAL '2 days'),
(5, 30, 'PROPHET', 2.40, 9.60, 3.70, 1.80, 54.00, 64.80, 49.00, 60.00, NOW() - INTERVAL '1 day'),
(6, 30, 'PROPHET', 1.60, 8.40, 2.50, 0.95, 28.50, 34.20, 25.00, 32.00, NOW() - INTERVAL '12 hours');

INSERT INTO ai_forecast_versions (version_code, product_id, model_name, horizon_days, mape, generated_at) VALUES
('FCAST-2026-03-01-01', 1, 'PROPHET', 30, 13.40, NOW() - INTERVAL '4 days'),
('FCAST-2026-02-24-03', 1, 'ARIMA', 30, 14.10, NOW() - INTERVAL '10 days'),
('FCAST-2026-03-02-02', 2, 'PROPHET', 30, 14.10, NOW() - INTERVAL '3 days'),
('FCAST-2026-03-04-01', 3, 'PROPHET', 30, 11.80, NOW() - INTERVAL '2 days'),
('FCAST-2026-03-05-04', 5, 'PROPHET', 30, 9.60, NOW() - INTERVAL '1 day'),
('FCAST-2026-03-06-01', 6, 'PROPHET', 30, 8.40, NOW() - INTERVAL '12 hours');

INSERT INTO report_schedules (report_type, schedule_code, to_email, active, updated_by) VALUES
('sales-daily', 'DAILY_18_00', 'manager@example.com', TRUE, 'Demo Admin'),
('stock-low', 'DAILY_09_00', 'owner@example.com', TRUE, 'Demo Admin');

INSERT INTO email_settings
(smtp_host, smtp_port, smtp_user, smtp_password, sender_name, sender_email, use_tls, alert_expiry_days, alert_low_stock_enabled, alert_expiry_enabled)
VALUES
('smtp.gmail.com', 587, '', '', 'AI Inventory', '', TRUE, 7, TRUE, TRUE);

INSERT INTO email_recipients (email_setting_id, recipient_email) VALUES
(1, 'manager@example.com'),
(1, 'owner@example.com');

COMMIT;
