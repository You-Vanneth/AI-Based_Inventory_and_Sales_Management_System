import { dbQuery, isMysqlEnabled } from "../config/db.js";
import { nowIso } from "../utils/helpers.js";
import { hashPassword, hashToken, issueAuthToken, verifyPassword } from "../utils/security.js";

export function createAuthController({ authTokens }) {
  return {
    health(_req, res) {
      res.json({ ok: true, service: "ai-inventory-backend", time: nowIso() });
    },

    async login(req, res) {
      const { email, password } = req.body || {};
      if (isMysqlEnabled()) {
        try {
          const rows = await dbQuery(
            `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.locked, r.code AS role_name
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE LOWER(u.email) = LOWER($1)
             LIMIT 1`,
            [String(email || "").trim()]
          );
          const row = rows[0];
          if (!row) {
            if (isMysqlEnabled()) return res.status(401).json({ message: "Invalid email or password" });
          } else {
            const pass = String(password || "");
            const stored = String(row.password_hash || "");
            const passwordCheck = verifyPassword(pass, stored);
            if (!passwordCheck.valid) return res.status(401).json({ message: "Invalid email or password" });
            if (row.locked) return res.status(403).json({ message: "Account is locked" });

            const token = issueAuthToken({ userId: row.id, role: row.role_name });
            authTokens.set(token, Number(row.id));
            if (passwordCheck.needsRehash) {
              await dbQuery("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashPassword(pass), row.id]);
            }
            await dbQuery("UPDATE users SET last_login = NOW() WHERE id = $1", [row.id]);
            await dbQuery(
              "INSERT INTO user_sessions (user_id, device, ip, started_at, active) VALUES ($1, $2, $3, NOW(), TRUE)",
              [row.id, "Web Browser", req.ip]
            );
            await dbQuery(
              "INSERT INTO auth_tokens (user_id, token_hash, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days')",
              [row.id, hashToken(token)]
            );
            await dbQuery(
              "INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES ($1, 'LOGIN', $2, NOW())",
              [row.id, row.username]
            );
            return res.json({
              data: {
                token,
                user: {
                  id: Number(row.id),
                  username: row.username,
                  email: row.email,
                  full_name: row.full_name,
                  role: row.role_name,
                  role_name: row.role_name
                }
              }
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("postgres login failed:", err.message);
          return res.status(500).json({ message: "Login failed" });
        }
      }

      return res.status(503).json({ message: "PostgreSQL is not configured" });
    },

    async logout(req, res) {
      const authHeader = req.header("authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (isMysqlEnabled() && token) {
        try {
          await dbQuery("UPDATE auth_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL", [hashToken(token)]);
          await dbQuery(
            "INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES ($1, 'LOGOUT', $2, NOW())",
            [req.user?.id || null, req.user?.username || "unknown"]
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("postgres logout failed:", err.message);
        }
      }
      if (token) authTokens.delete(token);
      res.json({ data: { ok: true } });
    },

    me(req, res) {
      res.json({
        data: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          full_name: req.user.full_name,
          role: req.user.role,
          role_name: req.user.role_name
        }
      });
    }
  };
}
