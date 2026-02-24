# Production Checklist

## 1) Security
- Change default admin credentials immediately.
- Generate strong `JWT_SECRET` (at least 32+ chars).
- Set dedicated DB user (`app_user`) with least privilege.
- Restrict DB access to trusted host(s) only.

## 2) Environment
- Copy `backend/.env.production.example` to `backend/.env` on server.
- Fill production DB credentials.
- Set `NODE_ENV=production`.

## 3) Database
- Import schema:
  - `docs/01-database-schema.sql`
- Create backup before go-live:
  - `backend/scripts/backup-db.sh`

## 4) Run with PM2
- Install PM2 globally:
  - `npm i -g pm2`
- Start app:
  - `cd backend && pm2 start ecosystem.config.cjs`
- Save process list:
  - `pm2 save`
- Enable startup:
  - `pm2 startup`

## 5) Health and Smoke Checks
- API health:
  - `GET /api/v1/health`
- Login as admin.
- Create category, product, sale.
- Verify dashboard and reports load.

## 6) Backups and Recovery
- Backup example:
```bash
cd backend
DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD='your_password' DB_NAME=ai_inventory_sales_db ./scripts/backup-db.sh
```
- Restore example:
```bash
cd backend
DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD='your_password' DB_NAME=ai_inventory_sales_db ./scripts/restore-db.sh ./backups/<file>.sql
```

## 7) Monitoring
- Use `pm2 logs ai-inventory-sales-api`.
- Track server CPU/memory and disk space.
- Rotate logs if needed.
