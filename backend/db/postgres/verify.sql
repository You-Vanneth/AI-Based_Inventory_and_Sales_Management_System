SELECT 'roles' AS table_name, COUNT(*) AS total FROM roles
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'stock_lots', COUNT(*) FROM stock_lots
UNION ALL SELECT 'inventory_movements', COUNT(*) FROM inventory_movements
UNION ALL SELECT 'sales', COUNT(*) FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'shift_closures', COUNT(*) FROM shift_closures
UNION ALL SELECT 'report_runs', COUNT(*) FROM report_runs
UNION ALL SELECT 'report_schedules', COUNT(*) FROM report_schedules
UNION ALL SELECT 'ai_model_performance', COUNT(*) FROM ai_model_performance
UNION ALL SELECT 'ai_forecast_runs', COUNT(*) FROM ai_forecast_runs
UNION ALL SELECT 'ai_forecast_versions', COUNT(*) FROM ai_forecast_versions
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL SELECT 'notification_rules', COUNT(*) FROM notification_rules
UNION ALL SELECT 'email_settings', COUNT(*) FROM email_settings
UNION ALL SELECT 'email_recipients', COUNT(*) FROM email_recipients
UNION ALL SELECT 'auth_tokens', COUNT(*) FROM auth_tokens
UNION ALL SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL SELECT 'user_permissions', COUNT(*) FROM user_permissions
UNION ALL SELECT 'user_activity_logs', COUNT(*) FROM user_activity_logs
ORDER BY table_name;
