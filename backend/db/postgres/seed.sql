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
('Hand Soap', '8850011', 2, 2, 0.90, 1.40, 8, 'Clean Plus', NULL, 'ACTIVE', 18, 'MAIN');

INSERT INTO stock_lots (product_id, lot_no, qty, expiry_date, supplier, store_code) VALUES
(3, 'MILK-A12', 4, '2026-03-10', 'Dairy KH', 'MAIN'),
(3, 'MILK-B07', 4, '2026-03-18', 'Dairy KH', 'MAIN'),
(2, 'NDL-C33', 5, '2026-08-15', 'Noodle Trading', 'MAIN');

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

INSERT INTO ai_forecast_versions (version_code, product_id, model_name, horizon_days, mape, generated_at) VALUES
('FCAST-2026-03-01-01', 1, 'PROPHET', 30, 13.40, NOW() - INTERVAL '4 days'),
('FCAST-2026-02-24-03', 1, 'ARIMA', 30, 14.10, NOW() - INTERVAL '10 days');

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
