USE ai_inventory_sales_db;

CREATE TABLE IF NOT EXISTS roles (
  role_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL,
  role_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_roles_code (role_code),
  UNIQUE KEY uq_roles_name (role_name),
  KEY idx_roles_active (is_active),
  KEY idx_roles_deleted (deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  permission_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL,
  permission_name VARCHAR(150) NOT NULL,
  module_name VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permissions_key (permission_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id BIGINT UNSIGNED NULL AFTER role,
  ADD KEY IF NOT EXISTS idx_users_role_id (role_id);

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_role_id'
);
SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_users_role_id FROM @fk_sql;
EXECUTE stmt_fk_users_role_id;
DEALLOCATE PREPARE stmt_fk_users_role_id;

INSERT INTO roles (role_code, role_name, description, is_system, is_active)
SELECT 'ADMIN', 'Administrator', 'Full system access', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'ADMIN');

INSERT INTO roles (role_code, role_name, description, is_system, is_active)
SELECT 'STAFF', 'Staff', 'Sales and stock operations', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'STAFF');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'dashboard.view', 'View Dashboard', 'dashboard'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'dashboard.view');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'users.manage', 'Manage Users', 'users'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'users.manage');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'roles.manage', 'Manage Roles and Permissions', 'users'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'roles.manage');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'categories.manage', 'Manage Categories', 'products'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'categories.manage');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'products.view', 'View Products', 'products'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'products.view');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'products.manage', 'Manage Products', 'products'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'products.manage');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'sales.create', 'Create Sales', 'sales'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'sales.create');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'inventory.view', 'View Stock and Inventory', 'inventory'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'inventory.view');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'reports.view', 'View Reports', 'reports'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'reports.view');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'ai.view', 'View AI Recommendations', 'ai'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'ai.view');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'email.manage', 'Configure Email Alerts', 'settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'email.manage');

INSERT INTO permissions (permission_key, permission_name, module_name)
SELECT 'settings.manage', 'Manage System Settings', 'settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'settings.manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON 1=1
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id AND rp.permission_id = p.permission_id
WHERE r.role_code = 'ADMIN'
  AND rp.role_id IS NULL;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN ('dashboard.view','products.view','sales.create','inventory.view','ai.view')
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id AND rp.permission_id = p.permission_id
WHERE r.role_code = 'STAFF'
  AND rp.role_id IS NULL;

UPDATE users u
JOIN roles r ON r.role_code = u.role
SET u.role_id = r.role_id
WHERE u.role_id IS NULL;
