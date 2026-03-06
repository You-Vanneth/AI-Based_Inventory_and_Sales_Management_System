CREATE DATABASE IF NOT EXISTS ai_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_inventory;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role_id INT NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  locked TINYINT(1) NOT NULL DEFAULT 0,
  force_reset TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(120) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  permission_code VARCHAR(120) NOT NULL,
  UNIQUE KEY uk_user_permissions (user_id, permission_code),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device VARCHAR(120) NULL,
  ip VARCHAR(64) NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash TEXT NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  UNIQUE KEY uk_auth_token_hash (token_hash(255)),
  KEY idx_auth_tokens_user_id (user_id),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  detail TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_activity_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(120) NOT NULL UNIQUE,
  name_km VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  icon_url TEXT NOT NULL,
  created_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(120) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(160) NOT NULL,
  barcode VARCHAR(80) NOT NULL UNIQUE,
  category_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier VARCHAR(160) NOT NULL DEFAULT '',
  expiry_date DATE NULL,
  image_url TEXT NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  monthly_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_products_category_id (category_id),
  KEY idx_products_store_code (store_code),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  lot_no VARCHAR(80) NOT NULL,
  qty DECIMAL(12,2) NOT NULL,
  expiry_date DATE NULL,
  supplier VARCHAR(160) NOT NULL DEFAULT '',
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_lots_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  qty DECIMAL(12,2) NOT NULL,
  reason VARCHAR(200) NOT NULL DEFAULT '',
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  approved_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_movements_product_id (product_id),
  CONSTRAINT fk_inventory_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sale_code VARCHAR(40) NOT NULL UNIQUE,
  sale_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method ENUM('CASH','BANK_TRANSFER') NOT NULL,
  customer_name VARCHAR(120) NOT NULL DEFAULT '-',
  customer_phone VARCHAR(40) NOT NULL DEFAULT '-',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  khr_rate DECIMAL(12,2) NOT NULL DEFAULT 4100,
  total_khr DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'SYNCED',
  is_refund TINYINT(1) NOT NULL DEFAULT 0,
  refund_reason VARCHAR(200) NULL,
  source_sale_id BIGINT NULL,
  created_by VARCHAR(120) NULL,
  KEY idx_sales_sale_time (sale_time),
  KEY idx_sales_payment_method (payment_method),
  CONSTRAINT fk_sales_source_sale FOREIGN KEY (source_sale_id) REFERENCES sales(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT NOT NULL,
  product_id INT NOT NULL,
  qty DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  KEY idx_sale_items_sale_id (sale_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shift_closures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_in DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_out DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_sales_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  expected_drawer DECIMAL(12,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  created_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  filter_text VARCHAR(200) NOT NULL DEFAULT '-',
  compare_prev TINYINT(1) NOT NULL DEFAULT 0,
  generated_by VARCHAR(120) NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  schedule_code VARCHAR(40) NOT NULL,
  to_email VARCHAR(200) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(120) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_model_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL,
  prophet_mape DECIMAL(8,2) NOT NULL,
  arima_mape DECIMAL(8,2) NOT NULL,
  prophet_mae DECIMAL(8,2) NOT NULL,
  arima_mae DECIMAL(8,2) NOT NULL,
  prophet_rmse DECIMAL(8,2) NOT NULL,
  arima_rmse DECIMAL(8,2) NOT NULL,
  selected_model ENUM('PROPHET','ARIMA') NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_forecast_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  horizon_days INT NOT NULL,
  selected_model ENUM('PROPHET','ARIMA') NOT NULL,
  mae DECIMAL(8,2) NOT NULL,
  mape DECIMAL(8,2) NOT NULL,
  rmse DECIMAL(8,2) NOT NULL,
  avg_daily_demand DECIMAL(12,2) NOT NULL,
  forecast_total DECIMAL(12,2) NOT NULL,
  reorder_level DECIMAL(12,2) NOT NULL,
  ci_low DECIMAL(12,2) NOT NULL,
  ci_high DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_forecast_runs_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_forecast_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  version_code VARCHAR(80) NOT NULL UNIQUE,
  product_id INT NOT NULL,
  model_name ENUM('PROPHET','ARIMA') NOT NULL,
  horizon_days INT NOT NULL,
  mape DECIMAL(8,2) NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_forecast_versions_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  notification_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notification_type VARCHAR(50) NOT NULL,
  priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  product_id INT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(80) NOT NULL DEFAULT 'IN_APP',
  delivery_status ENUM('SENT','FAILED','PENDING') NOT NULL DEFAULT 'SENT',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  snoozed_until DATETIME NULL,
  source_link VARCHAR(200) NOT NULL DEFAULT '-',
  read_by INT NULL,
  read_at DATETIME NULL,
  KEY idx_notifications_is_read (is_read),
  KEY idx_notifications_type (notification_type),
  CONSTRAINT fk_notifications_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_notifications_read_by FOREIGN KEY (read_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(40) NOT NULL,
  channel_in_app TINYINT(1) NOT NULL DEFAULT 1,
  channel_email TINYINT(1) NOT NULL DEFAULT 1,
  low_stock_threshold DECIMAL(12,2) NOT NULL DEFAULT 10,
  expiry_window_days INT NOT NULL DEFAULT 7,
  dedup_minutes INT NOT NULL DEFAULT 30,
  suppression_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_code VARCHAR(50) NOT NULL UNIQUE,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  channel VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  smtp_host VARCHAR(200) NOT NULL DEFAULT '',
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_user VARCHAR(200) NOT NULL DEFAULT '',
  smtp_password TEXT NOT NULL,
  sender_name VARCHAR(120) NOT NULL DEFAULT 'AI Inventory',
  sender_email VARCHAR(200) NOT NULL DEFAULT '',
  use_tls TINYINT(1) NOT NULL DEFAULT 1,
  alert_expiry_days INT NOT NULL DEFAULT 7,
  alert_low_stock_enabled TINYINT(1) NOT NULL DEFAULT 1,
  alert_expiry_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_setting_id INT NOT NULL,
  recipient_email VARCHAR(200) NOT NULL,
  UNIQUE KEY uk_email_recipients (email_setting_id, recipient_email),
  CONSTRAINT fk_email_recipients_setting FOREIGN KEY (email_setting_id) REFERENCES email_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DELIMITER //

DROP TRIGGER IF EXISTS trg_users_updated_at//
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_categories_updated_at//
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_products_updated_at//
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at//
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_notification_rules_updated_at//
CREATE TRIGGER trg_notification_rules_updated_at
BEFORE UPDATE ON notification_rules
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_email_settings_updated_at//
CREATE TRIGGER trg_email_settings_updated_at
BEFORE UPDATE ON email_settings
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DROP TRIGGER IF EXISTS trg_report_schedules_updated_at//
CREATE TRIGGER trg_report_schedules_updated_at
BEFORE UPDATE ON report_schedules
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

DELIMITER ;
