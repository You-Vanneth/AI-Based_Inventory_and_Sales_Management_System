import { Pool } from "pg";

const mysqlEnabled = Boolean(process.env.DATABASE_URL);
let mysqlPool = null;
const BOOLEAN_COLUMNS = [
  "active",
  "acknowledged",
  "alert_expiry_enabled",
  "alert_low_stock_enabled",
  "channel_email",
  "channel_in_app",
  "compare_prev",
  "force_reset",
  "is_read",
  "is_refund",
  "locked",
  "suppression_enabled",
  "use_tls"
];

function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function convertBooleans(sql) {
  let nextSql = sql;
  for (const column of BOOLEAN_COLUMNS) {
    const pattern = new RegExp(`\\b${column}\\b\\s*=\\s*([01])`, "gi");
    nextSql = nextSql.replace(pattern, (_match, value) => `${column} = ${value === "1" ? "TRUE" : "FALSE"}`);
  }
  return nextSql;
}

function convertDateFormat(sql) {
  return sql
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d %H:%i'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD HH24:MI')")
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/gi, "TO_CHAR($1, 'YYYY-MM')")
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");
}

function convertDateMath(sql) {
  return sql
    .replace(/CURDATE\(\)/gi, "CURRENT_DATE")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+\$([0-9]+)\s+DAY\)/gi, "($1 + ($$2 * INTERVAL '1 day'))")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+([0-9]+)\s+DAY\)/gi, "($1 + INTERVAL '$2 days')")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+\$([0-9]+)\s+HOUR\)/gi, "($1 + ($$2 * INTERVAL '1 hour'))")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+([0-9]+)\s+HOUR\)/gi, "($1 + INTERVAL '$2 hours')")
    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+\$([0-9]+)\s+DAY\)/gi, "($1 - ($$2 * INTERVAL '1 day'))")
    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+([0-9]+)\s+DAY\)/gi, "($1 - INTERVAL '$2 days')")
    .replace(/DATEDIFF\(([^,]+),\s*CURRENT_DATE\)/gi, "(($1)::date - CURRENT_DATE)");
}

function convertDateParts(sql) {
  return sql
    .replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)")
    .replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)")
    .replace(/QUARTER\(([^)]+)\)/gi, "EXTRACT(QUARTER FROM $1)")
    .replace(/CAST\(EXTRACT\(YEAR FROM ([^)]+)\) AS CHAR\)/gi, "(EXTRACT(YEAR FROM $1)::int::text)");
}

function convertSyntax(sql) {
  let nextSql = sql.replace(/`([^`]+)`/g, "\"$1\"");
  nextSql = convertPlaceholders(nextSql);
  nextSql = convertBooleans(nextSql);
  nextSql = convertDateFormat(nextSql);
  nextSql = convertDateMath(nextSql);
  nextSql = convertDateParts(nextSql);
  return nextSql;
}

function withInsertReturning(sql) {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith("INSERT INTO") || /\bRETURNING\b/i.test(sql)) {
    return sql;
  }
  return `${sql.trim()} RETURNING id`;
}

function normalizeInsertId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function getDatabaseTargetLabel() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return "DATABASE_URL is not set";

  try {
    const url = new URL(connectionString);
    const dbName = url.pathname.replace(/^\//, "") || "<unknown-db>";
    const username = url.username || "<unknown-user>";
    const hostname = url.hostname || "<unknown-host>";
    const port = url.port || "5432";
    return `${username}@${hostname}:${port}/${dbName}`;
  } catch {
    return "DATABASE_URL is invalid";
  }
}

export function describeDatabaseConnectionError(error) {
  const target = getDatabaseTargetLabel();

  if (!error) {
    return `PostgreSQL connection failed for ${target}.`;
  }

  if (error.code === "28P01") {
    return `PostgreSQL authentication failed for ${target}. Check the username/password in backend/.env DATABASE_URL.`;
  }

  if (error.code === "ECONNREFUSED") {
    return `PostgreSQL is not accepting connections at ${target}. Start PostgreSQL or update backend/.env DATABASE_URL.`;
  }

  if (error.code === "3D000") {
    return `PostgreSQL database does not exist for ${target}. Create the database or update backend/.env DATABASE_URL.`;
  }

  return `PostgreSQL connection failed for ${target}: ${error.message}`;
}

export function isMysqlEnabled() {
  return mysqlEnabled;
}

export function getMysqlPool() {
  if (!mysqlEnabled) return null;
  if (!mysqlPool) {
    mysqlPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }
  return mysqlPool;
}

export async function pingMysql() {
  const pool = getMysqlPool();
  if (!pool) throw new Error("PostgreSQL is not configured");
  await pool.query("SELECT 1 AS ok");
  return true;
}

export async function closeMysqlPool() {
  if (!mysqlPool) return;
  await mysqlPool.end();
  mysqlPool = null;
}

export async function dbQuery(sql, params = []) {
  const pool = getMysqlPool();
  if (!pool) throw new Error("PostgreSQL is not configured");
  const adaptedSql = withInsertReturning(convertSyntax(sql));
  const result = await pool.query(adaptedSql, params);
  const rows = result.rows || [];
  rows.insertId = rows[0]?.id !== undefined ? normalizeInsertId(rows[0].id) : 0;
  rows.affectedRows = result.rowCount || 0;
  rows.rowCount = result.rowCount || 0;
  return rows;
}
