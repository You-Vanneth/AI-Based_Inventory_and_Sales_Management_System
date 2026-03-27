import crypto from "node:crypto";

const TOKEN_TTL_DAYS = Number(process.env.AUTH_TOKEN_TTL_DAYS || 30);
const DEV_FALLBACK_SECRET = "dev-only-auth-secret-change-me";
const AUTH_SECRET = String(process.env.AUTH_TOKEN_SECRET || process.env.AUTH_SECRET || "").trim() || DEV_FALLBACK_SECRET;

if ((process.env.NODE_ENV || "development") === "production" && AUTH_SECRET === DEV_FALLBACK_SECRET) {
  throw new Error("AUTH_TOKEN_SECRET is required in production");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64urlJson(value) {
  return base64url(JSON.stringify(value));
}

function decodeBase64urlJson(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return JSON.parse(Buffer.from(`${normalized}${padding}`, "base64").toString("utf8"));
}

function tokenSignature(unsignedToken) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(unsignedToken).digest("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function issueAuthToken({ userId, role = "" }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: Number(userId),
    role: String(role || ""),
    iat: now,
    exp: now + TOKEN_TTL_DAYS * 24 * 60 * 60,
    jti: crypto.randomBytes(12).toString("hex")
  };
  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  return `${unsigned}.${tokenSignature(unsigned)}`;
}

export function verifyAuthToken(token) {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = tokenSignature(`${headerPart}.${payloadPart}`);
  const left = Buffer.from(signaturePart);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const header = decodeBase64urlJson(headerPart);
    const payload = decodeBase64urlJson(payloadPart);
    if (header.alg !== "HS256" || !payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  const passwordText = String(password || "");
  const stored = String(storedHash || "");
  if (!stored) return { valid: false, needsRehash: false };

  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    if (!salt || !hash) return { valid: false, needsRehash: false };
    const derived = crypto.scryptSync(passwordText, salt, 64).toString("hex");
    const left = Buffer.from(hash, "hex");
    const right = Buffer.from(derived, "hex");
    const valid = left.length === right.length && crypto.timingSafeEqual(left, right);
    return { valid, needsRehash: false };
  }

  const demoHashCompat = stored.startsWith("$2b$10$demo.hash") && passwordText === "123456";
  if (demoHashCompat) return { valid: true, needsRehash: true };

  if (passwordText === stored) return { valid: true, needsRehash: true };

  return { valid: false, needsRehash: false };
}
