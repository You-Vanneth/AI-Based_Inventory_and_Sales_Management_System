import mysql from "mysql2/promise";

let mysqlEnabled = Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
let mysqlPool = null;

export function isMysqlEnabled() {
  return mysqlEnabled;
}

export function getMysqlPool() {
  if (!mysqlEnabled) return null;
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "ai_inventory",
      socketPath: process.env.MYSQL_SOCKET || undefined,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return mysqlPool;
}

export async function dbQuery(sql, params = []) {
  const pool = getMysqlPool();
  if (!pool) throw new Error("MySQL is not configured");
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    mysqlEnabled = false;
    // eslint-disable-next-line no-console
    console.error("MySQL unavailable, switching to in-memory fallback:", err.message);
    const firstWord = String(sql || "").trim().split(/\s+/)[0]?.toUpperCase();
    if (firstWord === "SELECT" || firstWord === "SHOW" || firstWord === "DESCRIBE" || firstWord === "DESC") {
      return [];
    }
    return { insertId: 0, affectedRows: 0 };
  }
}
