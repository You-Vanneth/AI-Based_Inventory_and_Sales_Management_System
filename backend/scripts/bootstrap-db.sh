#!/usr/bin/env bash
set -euo pipefail

# Usage:
# DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD= DB_NAME=ai_inventory_sales_db ./scripts/bootstrap-db.sh

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_USER:=root}"
: "${DB_PASSWORD:=}"
: "${DB_NAME:=ai_inventory_sales_db}"

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/docs/01-database-schema.sql"
RBAC_FILE="${ROOT_DIR}/docs/09-rbac-roles-permissions.sql"
SEED_FILE="${ROOT_DIR}/docs/11-seed-review-data.sql"

echo "[1/3] Applying schema: ${SCHEMA_FILE}"
MYSQL_PWD="${DB_PASSWORD}" mysql \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" < "${SCHEMA_FILE}"

echo "[2/3] Applying RBAC roles/permissions: ${RBAC_FILE}"
MYSQL_PWD="${DB_PASSWORD}" mysql \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" < "${RBAC_FILE}"

echo "[3/3] Applying demo seed data: ${SEED_FILE}"
MYSQL_PWD="${DB_PASSWORD}" mysql \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" "${DB_NAME}" < "${SEED_FILE}"

echo "Database bootstrap completed."
echo "Default admin login: admin@local.com / Admin@12345"
