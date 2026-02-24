# Project Changelog

## Release: v1.0.0 (Initial Professional Build)

### Added
- Professional MySQL schema v2 with:
  - users, categories, products, sales, sale_items, payments
  - purchase_orders, purchase_order_items
  - inventory_movements, email_settings, system_logs
- Backend modules:
  - auth, users, categories, products, sales, payments
  - dashboard, email-settings, alerts, inventory, purchase-orders
  - reports, ai
- Frontend pages:
  - login, dashboard, categories, products, sales
  - reports, ai, email-settings
- PM2 deployment config and production checklist
- DB backup/restore scripts
- Automated tests (unit + API integration runner)

### Security/Architecture
- JWT auth with role guards
- Transaction-safe sales and stock-in flows
- CSP hardened (inline scripts removed)
- Standard API response/error envelopes

### Operations
- PM2 app ready
- Health endpoint available
- Integration test command available (`npm run test:api`)

## Known Notes
- `email-settings/test` requires valid SMTP credentials.
- Real production should use unique strong secrets/passwords.
