import crypto from "crypto";

function buildKey(secret) {
  return crypto.createHash("sha256").update(String(secret || "local-dev-smtp-key")).digest();
}

export function encryptSecret(value, secret) {
  const plain = String(value || "");
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", buildKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value, secret) {
  const input = String(value || "");
  if (!input) return "";
  if (!input.startsWith("enc:v1:")) return input;
  const [, , ivPart, tagPart, encryptedPart] = input.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    buildKey(secret),
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
