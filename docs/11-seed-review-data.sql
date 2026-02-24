USE ai_inventory_sales_db;

START TRANSACTION;

-- Demo users (password for all below: Admin@12345)
INSERT INTO users (full_name, email, password_hash, role, role_id, is_active)
SELECT 'System Admin', 'admin@local.com',
       '$2b$12$R4KOGn/YATFa8hvlBhxDoOD2PwQU12FRcWHVLTkDIGMaiy1a88Ijq',
       'ADMIN', r.role_id, 1
FROM roles r
WHERE r.role_code = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'admin@local.com' AND u.deleted_at IS NULL);

INSERT INTO users (full_name, email, password_hash, role, role_id, is_active)
SELECT 'Cashier One', 'cashier1@local.com',
       '$2b$12$R4KOGn/YATFa8hvlBhxDoOD2PwQU12FRcWHVLTkDIGMaiy1a88Ijq',
       'STAFF', r.role_id, 1
FROM roles r
WHERE r.role_code = 'STAFF'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'cashier1@local.com' AND u.deleted_at IS NULL);

INSERT INTO users (full_name, email, password_hash, role, role_id, is_active)
SELECT 'Cashier Two', 'cashier2@local.com',
       '$2b$12$R4KOGn/YATFa8hvlBhxDoOD2PwQU12FRcWHVLTkDIGMaiy1a88Ijq',
       'STAFF', r.role_id, 1
FROM roles r
WHERE r.role_code = 'STAFF'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'cashier2@local.com' AND u.deleted_at IS NULL);

SET @admin_user_id := (
  SELECT user_id FROM users WHERE email = 'admin@local.com' AND deleted_at IS NULL ORDER BY user_id ASC LIMIT 1
);
SET @cashier1_user_id := (
  SELECT user_id FROM users WHERE email = 'cashier1@local.com' AND deleted_at IS NULL ORDER BY user_id ASC LIMIT 1
);
SET @cashier2_user_id := (
  SELECT user_id FROM users WHERE email = 'cashier2@local.com' AND deleted_at IS NULL ORDER BY user_id ASC LIMIT 1
);

-- Demo categories
INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'Snack', 'Snacks and chips', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Snack' AND deleted_at IS NULL);

INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'Dairy', 'Milk and yogurt products', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Dairy' AND deleted_at IS NULL);

INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'Personal Care', 'Body and hair care items', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Personal Care' AND deleted_at IS NULL);

INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'Household', 'Household cleaning products', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Household' AND deleted_at IS NULL);

INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'Drink', 'Soft drinks and juices', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Drink' AND deleted_at IS NULL);

INSERT INTO categories (category_name, description, is_active, created_by, updated_by)
SELECT 'General', 'General grocery goods', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'General' AND deleted_at IS NULL);

-- Demo products (upsert by barcode)
INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Pepsi', '5449000001112', c.category_id, 38, 10, 1.40, 2.00, NULL, @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Drink' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Orange Juice', '8850001001234', c.category_id, 22, 8, 2.20, 3.50, DATE_ADD(CURDATE(), INTERVAL 15 DAY), @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Drink' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Potato Chips', '8996001412345', c.category_id, 16, 10, 0.80, 1.50, NULL, @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Snack' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Milk', '9556000123456', c.category_id, 9, 6, 1.10, 1.90, DATE_ADD(CURDATE(), INTERVAL 5 DAY), @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Dairy' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Yogurt', '9556000654321', c.category_id, 5, 5, 0.90, 1.60, DATE_ADD(CURDATE(), INTERVAL 3 DAY), @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Dairy' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Shampoo', '8851234500001', c.category_id, 18, 7, 2.50, 4.50, NULL, @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Personal Care' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Dish Soap', '8851234500002', c.category_id, 12, 6, 1.30, 2.70, NULL, @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'Household' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO products (product_name, barcode, category_id, quantity, min_stock_level, cost_price, selling_price, expiry_date, created_by, updated_by)
SELECT 'Instant Noodles', '8888000012345', c.category_id, 58, 20, 0.35, 0.75, NULL, @admin_user_id, @admin_user_id
FROM categories c WHERE c.category_name = 'General' AND c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category_id = VALUES(category_id),
  quantity = VALUES(quantity),
  min_stock_level = VALUES(min_stock_level),
  cost_price = VALUES(cost_price),
  selling_price = VALUES(selling_price),
  expiry_date = VALUES(expiry_date),
  updated_by = @admin_user_id,
  updated_at = CURRENT_TIMESTAMP;

-- Keep existing Coca Cola in low-stock demo state
UPDATE products
SET quantity = 4, min_stock_level = 5, cost_price = 1.50, selling_price = 2.00, updated_by = @admin_user_id, updated_at = CURRENT_TIMESTAMP
WHERE barcode = '5449000000996' AND deleted_at IS NULL;

-- Demo sales headers (unique by demo note)
INSERT INTO sales (sold_by, payment_status, subtotal, discount_total, tax_total, grand_total, sale_datetime, notes)
SELECT @cashier1_user_id, 'PAID', 8.00, 0.00, 0.00, 8.00, DATE_SUB(NOW(), INTERVAL 1 DAY), 'DEMO_SEED_SALE_A'
WHERE NOT EXISTS (SELECT 1 FROM sales WHERE notes = 'DEMO_SEED_SALE_A' AND deleted_at IS NULL);

INSERT INTO sales (sold_by, payment_status, subtotal, discount_total, tax_total, grand_total, sale_datetime, notes)
SELECT @cashier2_user_id, 'PAID', 11.90, 0.00, 0.00, 11.90, DATE_SUB(NOW(), INTERVAL 12 HOUR), 'DEMO_SEED_SALE_B'
WHERE NOT EXISTS (SELECT 1 FROM sales WHERE notes = 'DEMO_SEED_SALE_B' AND deleted_at IS NULL);

INSERT INTO sales (sold_by, payment_status, subtotal, discount_total, tax_total, grand_total, sale_datetime, notes)
SELECT @cashier1_user_id, 'PAID', 15.90, 0.00, 0.00, 15.90, DATE_SUB(NOW(), INTERVAL 6 HOUR), 'DEMO_SEED_SALE_C'
WHERE NOT EXISTS (SELECT 1 FROM sales WHERE notes = 'DEMO_SEED_SALE_C' AND deleted_at IS NULL);

INSERT INTO sales (sold_by, payment_status, subtotal, discount_total, tax_total, grand_total, sale_datetime, notes)
SELECT @cashier2_user_id, 'PARTIAL', 10.50, 0.00, 0.00, 10.50, DATE_SUB(NOW(), INTERVAL 2 HOUR), 'DEMO_SEED_SALE_D'
WHERE NOT EXISTS (SELECT 1 FROM sales WHERE notes = 'DEMO_SEED_SALE_D' AND deleted_at IS NULL);

-- Sale A items
INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 1.50, 2.00, 0.00, 4.00
FROM sales s JOIN products p ON p.barcode = '5449000000996'
WHERE s.notes = 'DEMO_SEED_SALE_A'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 1.40, 2.00, 0.00, 4.00
FROM sales s JOIN products p ON p.barcode = '5449000001112'
WHERE s.notes = 'DEMO_SEED_SALE_A'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

-- Sale B items
INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 3, 1.10, 1.90, 0.00, 5.70
FROM sales s JOIN products p ON p.barcode = '9556000123456'
WHERE s.notes = 'DEMO_SEED_SALE_B'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 0.90, 1.60, 0.00, 3.20
FROM sales s JOIN products p ON p.barcode = '9556000654321'
WHERE s.notes = 'DEMO_SEED_SALE_B'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 0.80, 1.50, 0.00, 3.00
FROM sales s JOIN products p ON p.barcode = '8996001412345'
WHERE s.notes = 'DEMO_SEED_SALE_B'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

-- Sale C items
INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 2.50, 4.50, 0.00, 9.00
FROM sales s JOIN products p ON p.barcode = '8851234500001'
WHERE s.notes = 'DEMO_SEED_SALE_C'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 1.30, 2.70, 0.00, 5.40
FROM sales s JOIN products p ON p.barcode = '8851234500002'
WHERE s.notes = 'DEMO_SEED_SALE_C'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 2, 0.35, 0.75, 0.00, 1.50
FROM sales s JOIN products p ON p.barcode = '8888000012345'
WHERE s.notes = 'DEMO_SEED_SALE_C'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

-- Sale D items
INSERT INTO sale_items (sale_id, product_id, quantity_sold, unit_cost, unit_price, discount_amount, line_total)
SELECT s.sale_id, p.product_id, 3, 2.20, 3.50, 0.00, 10.50
FROM sales s JOIN products p ON p.barcode = '8850001001234'
WHERE s.notes = 'DEMO_SEED_SALE_D'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.sale_id AND si.product_id = p.product_id AND si.deleted_at IS NULL);

-- Payments
INSERT INTO payments (sale_id, payment_method, amount, paid_at, reference_no, received_by, note)
SELECT s.sale_id, 'CASH', 8.00, s.sale_datetime, NULL, s.sold_by, 'DEMO PAYMENT A'
FROM sales s
WHERE s.notes = 'DEMO_SEED_SALE_A'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.sale_id AND p.note = 'DEMO PAYMENT A' AND p.deleted_at IS NULL);

INSERT INTO payments (sale_id, payment_method, amount, paid_at, reference_no, received_by, note)
SELECT s.sale_id, 'CARD', 11.90, s.sale_datetime, 'CARD-DEMO-B', s.sold_by, 'DEMO PAYMENT B'
FROM sales s
WHERE s.notes = 'DEMO_SEED_SALE_B'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.sale_id AND p.note = 'DEMO PAYMENT B' AND p.deleted_at IS NULL);

INSERT INTO payments (sale_id, payment_method, amount, paid_at, reference_no, received_by, note)
SELECT s.sale_id, 'E_WALLET', 15.90, s.sale_datetime, 'EWALLET-DEMO-C', s.sold_by, 'DEMO PAYMENT C'
FROM sales s
WHERE s.notes = 'DEMO_SEED_SALE_C'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.sale_id AND p.note = 'DEMO PAYMENT C' AND p.deleted_at IS NULL);

INSERT INTO payments (sale_id, payment_method, amount, paid_at, reference_no, received_by, note)
SELECT s.sale_id, 'CASH', 7.00, s.sale_datetime, NULL, s.sold_by, 'DEMO PAYMENT D'
FROM sales s
WHERE s.notes = 'DEMO_SEED_SALE_D'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.sale_id AND p.note = 'DEMO PAYMENT D' AND p.deleted_at IS NULL);

COMMIT;
