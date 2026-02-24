#!/usr/bin/env bash
set -euo pipefail

# Usage:
# DB_HOST=127.0.0.1 DB_PORT=3308 DB_USER=root DB_PASSWORD=secret DB_NAME=ai_inventory_sales_db ./scripts/restore-db.sh ./backups/file.sql

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup-file.sql>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_USER:=root}"
: "${DB_PASSWORD:=}"
: "${DB_NAME:=ai_inventory_sales_db}"

MYSQL_PWD="${DB_PASSWORD}" mysql \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" \
  "${DB_NAME}" < "${BACKUP_FILE}"

echo "Restore completed from: ${BACKUP_FILE}"
