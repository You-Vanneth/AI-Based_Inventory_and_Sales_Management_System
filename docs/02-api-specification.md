# AI Inventory & Sales Management System
## Professional API Specification (v1)

Base URL:
- `/api/v1`

General standards:
- Auth: JWT Bearer token
- Format: JSON only
- Time: ISO 8601 UTC (example: `2026-02-21T10:30:00Z`)
- Currency: decimal string with 2 digits (example: `"12.50"`)

Standard response envelope:
```json
{
  "success": true,
  "message": "Request successful",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Standard error envelope:
```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Email is invalid"
    }
  ]
}
```

RBAC:
- `ADMIN`: full access
- `STAFF`: sales, product read, dashboard read, limited stock views

## 1) Authentication

- `POST /auth/register` (ADMIN)
- `POST /auth/login` (PUBLIC)
- `POST /auth/logout` (ADMIN, STAFF)
- `GET /auth/me` (ADMIN, STAFF)
- `PATCH /auth/change-password` (ADMIN, STAFF)

Login request:
```json
{
  "email": "admin@local.com",
  "password": "Admin@12345"
}
```

Login response (`data`):
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "user_id": 1,
    "full_name": "Admin User",
    "email": "admin@local.com",
    "role": "ADMIN"
  }
}
```

## 2) Users (Admin)

- `GET /users`
- `POST /users`
- `GET /users/{userId}`
- `PATCH /users/{userId}`
- `PATCH /users/{userId}/status` (activate/deactivate)
- `DELETE /users/{userId}` (soft delete)

## 3) Categories

- `GET /categories` (ADMIN, STAFF)
- `POST /categories` (ADMIN)
- `GET /categories/{categoryId}` (ADMIN, STAFF)
- `PATCH /categories/{categoryId}` (ADMIN)
- `DELETE /categories/{categoryId}` (ADMIN, soft delete)

## 4) Products

- `GET /products` (ADMIN, STAFF)
- `POST /products` (ADMIN)
- `GET /products/{productId}` (ADMIN, STAFF)
- `PATCH /products/{productId}` (ADMIN)
- `DELETE /products/{productId}` (ADMIN, soft delete)
- `GET /products/by-barcode/{barcode}` (ADMIN, STAFF)
- `PATCH /products/{productId}/stock-adjustment` (ADMIN)

Stock adjustment request:
```json
{
  "adjustment_type": "ADJUSTMENT_IN",
  "quantity": 10,
  "reason": "Stock count correction"
}
```

## 5) Sales

- `GET /sales` (ADMIN, STAFF)
- `POST /sales` (ADMIN, STAFF)
- `GET /sales/{saleId}` (ADMIN, STAFF)
- `POST /sales/{saleId}/void` (ADMIN)

Create sale request:
```json
{
  "sale_datetime": "2026-02-21T11:00:00Z",
  "notes": "Walk-in customer",
  "items": [
    {
      "product_id": 10,
      "quantity_sold": 2,
      "unit_price": "4.50",
      "discount_amount": "0.00"
    }
  ],
  "payments": [
    {
      "payment_method": "CASH",
      "amount": "9.00",
      "reference_no": null
    }
  ]
}
```

Create sale rules:
- Run in a DB transaction
- Lock product rows while checking stock
- Reject when stock is insufficient
- Auto-insert `sale_items`, `payments`, `inventory_movements`
- Auto-update `products.quantity`

## 6) Payments

- `GET /payments` (ADMIN)
- `GET /payments/{paymentId}` (ADMIN)
- `POST /sales/{saleId}/payments` (ADMIN, STAFF)
- `DELETE /payments/{paymentId}` (ADMIN, soft delete/void policy)

## 7) Purchase Orders (Stock In)

- `GET /purchase-orders` (ADMIN)
- `POST /purchase-orders` (ADMIN)
- `GET /purchase-orders/{purchaseOrderId}` (ADMIN)
- `PATCH /purchase-orders/{purchaseOrderId}` (ADMIN)
- `POST /purchase-orders/{purchaseOrderId}/approve` (ADMIN)
- `POST /purchase-orders/{purchaseOrderId}/receive` (ADMIN)
- `POST /purchase-orders/{purchaseOrderId}/cancel` (ADMIN)

Receive PO request:
```json
{
  "received_date": "2026-02-21",
  "items": [
    {
      "purchase_order_item_id": 101,
      "quantity_received": 50,
      "expiry_date": "2026-10-01"
    }
  ]
}
```

Receive PO rules:
- Run in transaction
- Update `purchase_order_items.quantity_received`
- Update `products.quantity`
- Insert `inventory_movements` (`PURCHASE_IN`)

## 8) Inventory Movements

- `GET /inventory-movements` (ADMIN)
- `GET /inventory-movements/{movementId}` (ADMIN)
- Filters: `product_id`, `movement_type`, `date_from`, `date_to`

## 9) Alerts & Email Settings

- `GET /email-settings` (ADMIN)
- `PUT /email-settings` (ADMIN)
- `POST /email-settings/test` (ADMIN)
- `GET /alerts/low-stock` (ADMIN)
- `GET /alerts/expiring-soon` (ADMIN)

## 10) Dashboard & Reports

- `GET /dashboard/summary` (ADMIN, STAFF limited)
- `GET /reports/sales/daily` (ADMIN)
- `GET /reports/sales/monthly` (ADMIN)
- `GET /reports/stock/low` (ADMIN, STAFF)
- `GET /reports/stock/expiry` (ADMIN, STAFF)
- `GET /reports/ai/reorder-suggestions` (ADMIN)

Dashboard summary response (`data`):
```json
{
  "total_products": 250,
  "total_sales_today": "420.50",
  "monthly_revenue": "8500.00",
  "low_stock_count": 12,
  "expiring_soon_count": 7
}
```

## 11) AI Forecast (Moving Average)

- `GET /ai/forecast/products/{productId}?days=30&lead_time=7` (ADMIN)
- `GET /ai/reorder-recommendations?days=30&lead_time=7` (ADMIN)

Forecast response (`data`):
```json
{
  "product_id": 10,
  "average_daily_sales": 3.2,
  "lead_time_days": 7,
  "reorder_level": 22.4,
  "current_stock": 10,
  "suggested_purchase_qty": 13
}
```

## 12) System Logs

- `GET /system-logs` (ADMIN)
- `GET /system-logs/{logId}` (ADMIN)

## 13) Health & Roles

- `GET /health` (PUBLIC)
- `GET /roles` (permission: `users.manage` or `roles.manage`)
- `GET /roles/permissions` (permission: `users.manage` or `roles.manage`)
- `PATCH /roles/{roleId}` (permission: `roles.manage`)

## 14) HTTP Status Codes

- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Validation Error
- `500` Internal Server Error

## 15) Pagination & Filtering

Common query params:
- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `sort` (example: `-created_at`)
- `q` (search keyword)
- `date_from`, `date_to`

## 16) Security & Validation Rules

- Passwords stored as bcrypt hash only
- Validate all payloads with schema validator (Joi/Zod)
- Rate-limit login endpoint
- Record sensitive actions in `system_logs`
- Never expose `smtp_password_encrypted` in responses
- Enforce role checks in middleware
