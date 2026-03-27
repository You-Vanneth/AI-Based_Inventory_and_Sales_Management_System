function toBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function toNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const isProduction = nodeEnv === "production";
const frontendUrl = String(process.env.FRONTEND_URL || "").trim();
const corsOrigins = Array.from(new Set([frontendUrl, ...splitCsv(process.env.CORS_ORIGINS)]));
const port = toNumber(process.env.PORT, 5001);
const requestBodyLimit = String(process.env.REQUEST_BODY_LIMIT || "2mb");
const trustProxy = process.env.TRUST_PROXY === undefined ? false : process.env.TRUST_PROXY;
const authTokenSecret = String(process.env.AUTH_TOKEN_SECRET || process.env.AUTH_SECRET || "").trim();
const smtpEncryptionKey = String(process.env.SMTP_ENCRYPTION_KEY || authTokenSecret || "").trim();
const mysqlConfigured = Boolean(process.env.DATABASE_URL);

export const env = {
  nodeEnv,
  isProduction,
  port,
  host: isProduction ? "0.0.0.0" : "127.0.0.1",
  frontendUrl,
  corsOrigins,
  requestBodyLimit,
  trustProxy: trustProxy === false ? false : trustProxy === true ? true : toBool(trustProxy, false),
  authTokenSecret,
  smtpEncryptionKey,
  mysqlConfigured,
  authRateLimitWindowMs: toNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: toNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
  apiRateLimitWindowMs: toNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  apiRateLimitMax: toNumber(process.env.API_RATE_LIMIT_MAX, 240)
};

export function validateEnv() {
  const issues = [];

  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    issues.push("PORT must be a valid TCP port");
  }

  if (!env.mysqlConfigured) {
    issues.push("DATABASE_URL is required");
  }

  if (env.isProduction) {
    if (!env.frontendUrl) issues.push("FRONTEND_URL is required in production");
    if (!env.authTokenSecret) issues.push("AUTH_TOKEN_SECRET is required in production");
  }

  if (issues.length) {
    throw new Error(`Environment validation failed: ${issues.join("; ")}`);
  }
}
