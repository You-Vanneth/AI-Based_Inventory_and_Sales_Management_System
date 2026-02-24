# Backend Setup

## 1) Install dependencies
```bash
cd backend
npm install
```

## 2) Configure environment
```bash
cp .env.example .env
```

Update DB and JWT values in `.env` if needed.

## 3) Bootstrap database (schema + RBAC + seed)
```bash
DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD= DB_NAME=ai_inventory_sales_db ./scripts/bootstrap-db.sh
```

Default seeded admin:
- Email: `admin@local.com`
- Password: `Admin@12345`

## 4) Run server
```bash
npm run dev
```

Health endpoint:
- `GET http://localhost:5001/api/v1/health`

## 5) Run tests
```bash
npm test
```

Run API integration tests (requires running API server and seeded test admin):
```bash
API_BASE_URL=http://localhost:5001 TEST_ADMIN_EMAIL=admin@local.com TEST_ADMIN_PASSWORD='Admin@12345' npm run test:api
```

Run both:
```bash
API_BASE_URL=http://localhost:5001 TEST_ADMIN_EMAIL=admin@local.com TEST_ADMIN_PASSWORD='Admin@12345' npm run test:all
```

Run full school QA:
```bash
API_BASE_URL=http://localhost:5001 TEST_ADMIN_EMAIL=admin@local.com TEST_ADMIN_PASSWORD='Admin@12345' npm run school:qa
```
