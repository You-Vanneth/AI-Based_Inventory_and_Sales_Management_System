# API Handover Document

Base URL: `/api/v1`
Auth: Bearer JWT

## 1) Core Authentication
- `POST /auth/login`
- `POST /auth/register` (ADMIN)
- `GET /auth/me`
- `PATCH /auth/change-password`
- `POST /auth/logout`

## 2) Master Data
- Users (ADMIN): `/users`
- Categories: `/categories`
- Products: `/products`
- Product lookup: `GET /products/by-barcode/:barcode`

## 3) Sales & Payments
- `GET/POST /sales`
- `GET /sales/:saleId`
- `POST /sales/:saleId/void` (ADMIN)
- `POST /sales/:saleId/payments`
- `GET /payments` (ADMIN)
- `GET /payments/:paymentId` (ADMIN)
- `DELETE /payments/:paymentId` (ADMIN)

## 4) Purchase Orders (Stock-In)
- `GET/POST /purchase-orders`
- `GET/PATCH /purchase-orders/:purchaseOrderId`
- `POST /purchase-orders/:purchaseOrderId/approve`
- `POST /purchase-orders/:purchaseOrderId/receive`
- `POST /purchase-orders/:purchaseOrderId/cancel`

## 5) Inventory & Alerts
- `GET /inventory-movements`
- `GET /inventory-movements/:movementId`
- `GET /alerts/low-stock`
- `GET /alerts/expiring-soon`
- `POST /alerts/run-check`

## 6) Dashboard, Reports, AI
- `GET /dashboard/summary`
- `GET /reports/sales/daily`
- `GET /reports/sales/monthly`
- `GET /reports/stock/low`
- `GET /reports/stock/expiry`
- `GET /reports/ai/reorder-suggestions`
- `GET /ai/forecast/products/:productId`
- `GET /ai/reorder-recommendations`

## 7) Email Settings
- `GET /email-settings` (ADMIN)
- `PUT /email-settings` (ADMIN)
- `POST /email-settings/test` (ADMIN)

## 8) Response Contract
Success:
```json
{ "success": true, "message": "...", "data": {}, "meta": {} }
```
Error:
```json
{ "success": false, "message": "...", "error_code": "...", "errors": [] }
```

## 9) Operations
- PM2 process: `ai-inventory-sales-api`
- Health: `GET /api/v1/health`
- Logs: `pm2 logs ai-inventory-sales-api`
