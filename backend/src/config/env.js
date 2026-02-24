import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["PORT", "JWT_SECRET", "DB_HOST", "DB_PORT", "DB_USER", "DB_NAME"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  appName: process.env.APP_NAME || "AI Inventory and Sales API",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  alerts: {
    jobEnabled: process.env.ALERT_JOB_ENABLED !== "0",
    intervalMinutes: Number(process.env.ALERT_JOB_INTERVAL_MINUTES || 60)
  },
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
  }
};
