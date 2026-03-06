# AI Inventory Backend (Node.js)

## Run

```bash
cd /Users/youvanneth/Documents/Rotha/AI-Based_Inventory_and_Sales_Management_System/AI-Based_Inventory_and_Sales_Management_System/backend
npm install
npm run dev
```

Default URL: `http://localhost:5001`

## Database (PostgreSQL)

Set `DATABASE_URL` in `.env` (see `.env.example`), then run:

```bash
npm run db:schema
npm run db:seed
npm run db:verify
```

Or one-shot reset:

```bash
npm run db:reset
```

Schema file: `db/postgres/schema.sql`  
Seed file: `db/postgres/seed.sql`

## Database (XAMPP MySQL)

Use phpMyAdmin Import with these files:
- `db/mysql/schema.sql`
- `db/mysql/seed.sql`
- `db/mysql/verify.sql` (optional check)

Or run by command line (if `mysql` command exists):

```bash
npm run db:mysql:schema
npm run db:mysql:seed
npm run db:mysql:verify
```

Database name for XAMPP: `ai_inventory`

Backend DB connection env:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_SOCKET` (recommended for XAMPP on macOS)

Current live DB-backed APIs:
- Auth (`/auth/*`)
- Dashboard (`/dashboard/summary`)
- Categories (`/categories/*`)
- Products (`/products/*`)
- Inventory (`/inventory/*`)
- Sales (`/sales/*`)
- Reports (`/reports/*`)
- AI Forecast (`/ai/*`)
- Notifications (`/notifications/*`)
- Users (`/users/*`)
- Email Settings (`/email-settings/*`)

Main table names:
- `roles`
- `users`
- `user_permissions`
- `user_sessions`
- `auth_tokens`
- `user_activity_logs`
- `categories`
- `products`
- `stock_lots`
- `inventory_movements`
- `sales`
- `sale_items`
- `shift_closures`
- `report_runs`
- `report_schedules`
- `ai_model_performance`
- `ai_forecast_runs`
- `ai_forecast_versions`
- `notifications`
- `notification_preferences`
- `notification_rules`
- `email_settings`
- `email_recipients`

## Implemented endpoints

Public:
- `GET /api/v1/health`
- `POST /api/v1/auth/login`

Auth:
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

Dashboard:
- `GET /api/v1/dashboard/summary`

Categories:
- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `PUT /api/v1/categories/:id`
- `DELETE /api/v1/categories/:id`

Products:
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products`
- `PUT /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `POST /api/v1/products/import`

Inventory:
- `GET /api/v1/inventory/summary`
- `GET /api/v1/inventory/movements`
- `GET /api/v1/inventory/lots`
- `POST /api/v1/inventory/receive`
- `POST /api/v1/inventory/adjust`
- `POST /api/v1/inventory/adjust/bulk`

Sales:
- `GET /api/v1/sales`
- `POST /api/v1/sales`
- `POST /api/v1/sales/refund`
- `POST /api/v1/sales/shift-close`

Reports:
- `GET /api/v1/reports/run`
- `GET /api/v1/reports/history`
- `POST /api/v1/reports/export`
- `POST /api/v1/reports/schedule`

AI Forecast:
- `GET /api/v1/ai/model-performance`
- `GET /api/v1/ai/forecast/versions`
- `GET /api/v1/ai/forecast/history`
- `POST /api/v1/ai/forecast/run`
- `POST /api/v1/ai/forecast/bulk-run`

Notifications:
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/bulk-action`
- `POST /api/v1/notifications/retry-failed`
- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`
- `GET /api/v1/notifications/rules`
- `PATCH /api/v1/notifications/rules/:id/toggle`

Users:
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id`
- `DELETE /api/v1/users/:id`
- `PATCH /api/v1/users/:id/lock-toggle`
- `PATCH /api/v1/users/:id/force-reset`
- `GET /api/v1/users/:id/permissions`
- `PUT /api/v1/users/:id/permissions`
- `GET /api/v1/users/sessions`
- `POST /api/v1/users/:id/sessions/revoke`
- `POST /api/v1/users/:id/logout-all`
- `GET /api/v1/users/activity`

Email Settings:
- `GET /api/v1/email-settings`
- `PUT /api/v1/email-settings`
- `POST /api/v1/email-settings/test`

All `/api/v1/*` routes except health/login require Bearer token.

## Demo login

- email: `admin@example.com`
- password: `123456`

## Notes

- Frontend Vite proxy is configured to forward `/api` to `http://localhost:5001`.
- Data is in-memory (demo backend), so restart resets data.
