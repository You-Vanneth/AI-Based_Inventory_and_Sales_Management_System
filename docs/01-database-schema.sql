-- AI-Based Inventory & Sales Management System
-- Professional MySQL schema (v2)

CREATE DATABASE IF NOT EXISTS ai_inventory_sales_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_inventory_sales_db;

-- 1) users
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','STAFF') NOT NULL DEFAULT 'STAFF',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active),
  KEY idx_users_deleted (deleted_at)
) ENGINE=InnoDB;

-- 2) categories
CREATE TABLE IF NOT EXISTS categories (
  category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_categories_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_categories_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  UNIQUE KEY uq_categories_name (category_name),
  KEY idx_categories_active (is_active),
  KEY idx_categories_deleted (deleted_at)
) ENGINE=InnoDB;

-- 3) products
CREATE TABLE IF NOT EXISTS products (
  product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(190) NOT NULL,
  barcode VARCHAR(80) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  min_stock_level INT UNSIGNED NOT NULL DEFAULT 5,
  cost_price DECIMAL(12,2) NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  expiry_date DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_products_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_products_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_products_price_non_negative CHECK (cost_price >= 0 AND selling_price >= 0),
  UNIQUE KEY uq_products_barcode (barcode),
  KEY idx_products_name (product_name),
  KEY idx_products_category (category_id),
  KEY idx_products_expiry (expiry_date),
  KEY idx_products_low_stock (quantity, min_stock_level),
  KEY idx_products_deleted (deleted_at)
) ENGINE=InnoDB;

-- 4) sales (header)
CREATE TABLE IF NOT EXISTS sales (
  sale_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sold_by BIGINT UNSIGNED NOT NULL,
  payment_status ENUM('PENDING','PAID','PARTIAL') NOT NULL DEFAULT 'PAID',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_sales_sold_by
    FOREIGN KEY (sold_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sales_amounts_non_negative
    CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0),
  KEY idx_sales_datetime (sale_datetime),
  KEY idx_sales_user_datetime (sold_by, sale_datetime),
  KEY idx_sales_payment_status (payment_status),
  KEY idx_sales_deleted (deleted_at)
) ENGINE=InnoDB;

-- 5) sale_items (detail)
CREATE TABLE IF NOT EXISTS sale_items (
  sale_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity_sold INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sale_items_values_non_negative
    CHECK (quantity_sold > 0 AND unit_cost >= 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total >= 0),
  KEY idx_sale_items_sale (sale_id),
  KEY idx_sale_items_product (product_id),
  KEY idx_sale_items_deleted (deleted_at)
) ENGINE=InnoDB;

-- 6) payments
CREATE TABLE IF NOT EXISTS payments (
  payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('CASH','BANK_TRANSFER','CARD','E_WALLET','OTHER') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference_no VARCHAR(120) NULL,
  received_by BIGINT UNSIGNED NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_payments_sale
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_received_by
    FOREIGN KEY (received_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
  KEY idx_payments_sale (sale_id),
  KEY idx_payments_method (payment_method),
  KEY idx_payments_paid_at (paid_at),
  KEY idx_payments_deleted (deleted_at)
) ENGINE=InnoDB;

-- 7) purchase_orders (stock-in header)
CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(60) NOT NULL,
  supplier_name VARCHAR(190) NOT NULL,
  supplier_phone VARCHAR(40) NULL,
  supplier_email VARCHAR(190) NULL,
  status ENUM('DRAFT','APPROVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  received_date DATE NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_po_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_po_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_po_amounts_non_negative
    CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0),
  UNIQUE KEY uq_po_number (po_number),
  KEY idx_po_status (status),
  KEY idx_po_dates (order_date, expected_date, received_date),
  KEY idx_po_deleted (deleted_at)
) ENGINE=InnoDB;

-- 8) purchase_order_items (stock-in detail)
CREATE TABLE IF NOT EXISTS purchase_order_items (
  purchase_order_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity_ordered INT UNSIGNED NOT NULL,
  quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  expiry_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_po_items_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_po_items_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_po_items_values
    CHECK (quantity_ordered > 0 AND quantity_received >= 0 AND unit_cost >= 0 AND line_total >= 0),
  KEY idx_po_items_po (purchase_order_id),
  KEY idx_po_items_product (product_id),
  KEY idx_po_items_deleted (deleted_at)
) ENGINE=InnoDB;

-- 9) inventory_movements (full stock audit trail)
CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('SALE_OUT','PURCHASE_IN','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN_IN','RETURN_OUT') NOT NULL,
  qty_change INT NOT NULL,
  qty_before INT NOT NULL,
  qty_after INT NOT NULL,
  unit_cost DECIMAL(12,2) NULL,
  reference_type ENUM('SALE','PURCHASE_ORDER','MANUAL_ADJUSTMENT','SYSTEM') NOT NULL,
  reference_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_movements_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  KEY idx_movements_product_created (product_id, created_at),
  KEY idx_movements_type_created (movement_type, created_at),
  KEY idx_movements_reference (reference_type, reference_id)
) ENGINE=InnoDB;

-- 10) email_settings
CREATE TABLE IF NOT EXISTS email_settings (
  email_setting_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  smtp_host VARCHAR(190) NOT NULL,
  smtp_port INT UNSIGNED NOT NULL,
  smtp_user VARCHAR(190) NOT NULL,
  smtp_password_encrypted VARCHAR(255) NOT NULL,
  sender_name VARCHAR(120) NOT NULL,
  sender_email VARCHAR(190) NOT NULL,
  use_tls TINYINT(1) NOT NULL DEFAULT 1,
  alert_expiry_days INT UNSIGNED NOT NULL DEFAULT 7,
  alert_low_stock_enabled TINYINT(1) NOT NULL DEFAULT 1,
  alert_expiry_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_email_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  UNIQUE KEY uq_email_sender_email (sender_email),
  KEY idx_email_settings_deleted (deleted_at)
) ENGINE=InnoDB;

-- 11) system_logs (optional)
CREATE TABLE IF NOT EXISTS system_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  details_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  KEY idx_logs_actor (actor_user_id),
  KEY idx_logs_action (action_type),
  KEY idx_logs_entity (entity_type, entity_id),
  KEY idx_logs_created (created_at)
) ENGINE=InnoDB;

-- Helpful view: low stock products
CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT
  p.product_id,
  p.product_name,
  p.barcode,
  p.quantity,
  p.min_stock_level,
  c.category_name
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE p.quantity <= p.min_stock_level;

-- Helpful view: products expiring soon (uses 7 days default)
CREATE OR REPLACE VIEW v_products_expiring_soon AS
SELECT
  p.product_id,
  p.product_name,
  p.barcode,
  p.quantity,
  p.expiry_date,
  DATEDIFF(p.expiry_date, CURDATE()) AS days_left
FROM products p
WHERE p.expiry_date IS NOT NULL
  AND p.expiry_date >= CURDATE()
  AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY);

-- Helpful view: sales summary by day (AI moving-average input)
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  DATE(s.sale_datetime) AS sale_date,
  SUM(si.quantity_sold) AS total_units_sold,
  SUM(si.line_total) AS total_sales_amount
FROM sales s
JOIN sale_items si ON si.sale_id = s.sale_id
WHERE s.deleted_at IS NULL
  AND si.deleted_at IS NULL
GROUP BY DATE(s.sale_datetime);
