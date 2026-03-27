import { dbQuery, isMysqlEnabled } from "../config/db.js";
import { hashToken, verifyAuthToken } from "../utils/security.js";

export function createAuthRequired({ authTokens, users }) {
  return async function authRequired(req, res, next) {
    const authHeader = req.header("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const payload = verifyAuthToken(token);
    if (!payload) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = authTokens.get(token);
    if (userId) {
      req.user = users.find((u) => u.id === userId) || null;
      if (req.user) return next();
    }

    if (isMysqlEnabled()) {
      try {
        const rows = await dbQuery(
          `SELECT u.id, u.username, u.email, u.full_name, u.locked, u.status, r.code AS role_name
           FROM auth_tokens t
           JOIN users u ON u.id = t.user_id
           JOIN roles r ON r.id = u.role_id
           WHERE t.token_hash = $1 AND t.revoked_at IS NULL
             AND (t.expires_at IS NULL OR t.expires_at > NOW())
           LIMIT 1`,
          [hashToken(token)]
        );
        if (rows[0]) {
          const row = rows[0];
          if (String(row.status || "ACTIVE") !== "ACTIVE" || Boolean(row.locked)) {
            return res.status(403).json({ message: "Account is not active" });
          }
          req.user = {
            id: Number(row.id),
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            role: row.role_name,
            role_name: row.role_name,
            locked: Boolean(row.locked)
          };
          authTokens.set(token, req.user.id);
          return next();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("auth token lookup failed:", err.message);
      }
    }

    return res.status(401).json({ message: "Unauthorized" });
  };
}
