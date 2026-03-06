BEGIN;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  force_reset BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code VARCHAR(120) NOT NULL,
  UNIQUE (user_id, permission_code)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device VARCHAR(120),
  ip VARCHAR(64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(120) UNIQUE NOT NULL,
  name_km VARCHAR(120) UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  icon_url TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  product_name VARCHAR(160) NOT NULL,
  barcode VARCHAR(80) UNIQUE NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  min_stock_level NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
  supplier VARCHAR(160) NOT NULL DEFAULT '',
  expiry_date DATE,
  image_url TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  monthly_sales NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_sales >= 0),
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_lots (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_no VARCHAR(80) NOT NULL,
  qty NUMERIC(12, 2) NOT NULL CHECK (qty >= 0),
  expiry_date DATE,
  supplier VARCHAR(160) NOT NULL DEFAULT '',
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(40) NOT NULL,
  qty NUMERIC(12, 2) NOT NULL CHECK (qty >= 0),
  reason VARCHAR(200) NOT NULL DEFAULT '',
  store_code VARCHAR(40) NOT NULL DEFAULT 'MAIN',
  approved_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  sale_code VARCHAR(40) UNIQUE NOT NULL,
  sale_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
  customer_name VARCHAR(120) NOT NULL DEFAULT '-',
  customer_phone VARCHAR(40) NOT NULL DEFAULT '-',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  khr_rate NUMERIC(12, 2) NOT NULL DEFAULT 4100,
  total_khr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'SYNCED',
  is_refund BOOLEAN NOT NULL DEFAULT FALSE,
  refund_reason VARCHAR(200),
  source_sale_id BIGINT REFERENCES sales(id),
  created_by VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shift_closures (
  id BIGSERIAL PRIMARY KEY,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_in NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_out NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_sales_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_drawer NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  filter_text VARCHAR(200) NOT NULL DEFAULT '-',
  compare_prev BOOLEAN NOT NULL DEFAULT FALSE,
  generated_by VARCHAR(120),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(60) NOT NULL,
  schedule_code VARCHAR(40) NOT NULL,
  to_email VARCHAR(200) NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by VARCHAR(120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_model_performance (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL,
  prophet_mape NUMERIC(8, 2) NOT NULL,
  arima_mape NUMERIC(8, 2) NOT NULL,
  prophet_mae NUMERIC(8, 2) NOT NULL,
  arima_mae NUMERIC(8, 2) NOT NULL,
  prophet_rmse NUMERIC(8, 2) NOT NULL,
  arima_rmse NUMERIC(8, 2) NOT NULL,
  selected_model VARCHAR(20) NOT NULL CHECK (selected_model IN ('PROPHET', 'ARIMA'))
);

CREATE TABLE IF NOT EXISTS ai_forecast_runs (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  horizon_days INTEGER NOT NULL,
  selected_model VARCHAR(20) NOT NULL CHECK (selected_model IN ('PROPHET', 'ARIMA')),
  mae NUMERIC(8, 2) NOT NULL,
  mape NUMERIC(8, 2) NOT NULL,
  rmse NUMERIC(8, 2) NOT NULL,
  avg_daily_demand NUMERIC(12, 2) NOT NULL,
  forecast_total NUMERIC(12, 2) NOT NULL,
  reorder_level NUMERIC(12, 2) NOT NULL,
  ci_low NUMERIC(12, 2) NOT NULL,
  ci_high NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_forecast_versions (
  id BIGSERIAL PRIMARY KEY,
  version_code VARCHAR(80) UNIQUE NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  model_name VARCHAR(20) NOT NULL CHECK (model_name IN ('PROPHET', 'ARIMA')),
  horizon_days INTEGER NOT NULL,
  mape NUMERIC(8, 2) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  notification_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  product_id INTEGER REFERENCES products(id),
  message TEXT NOT NULL,
  channel VARCHAR(80) NOT NULL DEFAULT 'IN_APP',
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (delivery_status IN ('SENT', 'FAILED', 'PENDING')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  snoozed_until TIMESTAMPTZ,
  source_link VARCHAR(200) NOT NULL DEFAULT '-',
  read_by INTEGER REFERENCES users(id),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  role_code VARCHAR(40) NOT NULL,
  channel_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  channel_email BOOLEAN NOT NULL DEFAULT TRUE,
  low_stock_threshold NUMERIC(12, 2) NOT NULL DEFAULT 10,
  expiry_window_days INTEGER NOT NULL DEFAULT 7,
  dedup_minutes INTEGER NOT NULL DEFAULT 30,
  suppression_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id SERIAL PRIMARY KEY,
  rule_code VARCHAR(50) UNIQUE NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  channel VARCHAR(80) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_settings (
  id SERIAL PRIMARY KEY,
  smtp_host VARCHAR(200) NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user VARCHAR(200) NOT NULL DEFAULT '',
  smtp_password TEXT NOT NULL DEFAULT '',
  sender_name VARCHAR(120) NOT NULL DEFAULT 'AI Inventory',
  sender_email VARCHAR(200) NOT NULL DEFAULT '',
  use_tls BOOLEAN NOT NULL DEFAULT TRUE,
  alert_expiry_days INTEGER NOT NULL DEFAULT 7,
  alert_low_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  alert_expiry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_recipients (
  id SERIAL PRIMARY KEY,
  email_setting_id INTEGER NOT NULL REFERENCES email_settings(id) ON DELETE CASCADE,
  recipient_email VARCHAR(200) NOT NULL,
  UNIQUE (email_setting_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_store_code ON products(store_code);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_time ON sales(sale_time);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER trg_notification_rules_updated_at
BEFORE UPDATE ON notification_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_email_settings_updated_at ON email_settings;
CREATE TRIGGER trg_email_settings_updated_at
BEFORE UPDATE ON email_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_report_schedules_updated_at ON report_schedules;
CREATE TRIGGER trg_report_schedules_updated_at
BEFORE UPDATE ON report_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
