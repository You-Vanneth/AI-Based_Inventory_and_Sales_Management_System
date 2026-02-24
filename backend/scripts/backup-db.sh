#!/usr/bin/env bash
set -euo pipefail

# Usage:
# DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD=secret DB_NAME=ai_inventory_sales_db ./scripts/backup-db.sh

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_USER:=root}"
: "${DB_PASSWORD:=}"
: "${DB_NAME:=ai_inventory_sales_db}"

BACKUP_DIR="./backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

MYSQL_PWD="${DB_PASSWORD}" mysqldump \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" \
  --single-transaction \
  --routines \
  --triggers \
  "${DB_NAME}" > "${OUT_FILE}"

echo "Backup created: ${OUT_FILE}"
