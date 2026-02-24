# User Manual (Admin & Staff)

## 1) Login
- Open: `http://localhost:5001/login.html`
- Enter email and password.
- Admin can access all pages. Staff has limited access.

## 2) Admin Workflow (Recommended)
1. Go to `Categories` page and create categories.
2. Go to `Products` page and create products (manual barcode input).
3. Go to `Sales` page and create sales.
4. Check `Dashboard` for KPI summary.
5. Use `Reports` page for sales/stock reports.
6. Use `AI` page for forecast and reorder suggestions.
7. Use `Email` page to configure SMTP and test alert email.

## 3) Staff Workflow
1. Login with staff account.
2. View dashboard/products.
3. Create sales by barcode on `Sales` page.
4. Review own sales from sales list.

## 4) Product Management
- Required fields: name, barcode, category, quantity, cost price, selling price.
- Barcode is manual input (no hardware scanner needed).
- Product deletion is soft delete.

## 5) Sales Management
- Enter barcode + quantity + payment method + paid amount.
- System checks stock automatically.
- Stock decreases automatically on sale.
- Admin can void sale, and stock is restored.

## 6) Reports and AI
- Reports page includes:
  - Daily Sales
  - Monthly Sales
  - Low Stock
  - Expiring Soon
  - AI Reorder Suggestions
- AI page supports:
  - Forecast by product
  - Global reorder recommendations

## 7) Email Alerts
- Configure SMTP in `Email Settings` page.
- Save settings and click `Send Test Email`.
- Alert endpoints:
  - `/api/v1/alerts/low-stock`
  - `/api/v1/alerts/expiring-soon`
  - `/api/v1/alerts/run-check`

## 8) Troubleshooting
- If login fails: clear browser storage and login again.
- If API fails: check PM2 logs: `pm2 logs ai-inventory-sales-api`.
- If DB issue: check `.env` DB credentials and MySQL service.
