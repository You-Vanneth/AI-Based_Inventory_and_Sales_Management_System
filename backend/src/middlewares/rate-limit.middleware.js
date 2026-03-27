function defaultKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  keyPrefix = "global",
  message = "Too many requests",
  keyFn = defaultKey
} = {}) {
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${keyFn(req)}`;
    const current = buckets.get(key);

    if (!current || current.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        code: 429,
        message,
        retry_after_seconds: retryAfter
      });
    }

    return next();
  };
}
