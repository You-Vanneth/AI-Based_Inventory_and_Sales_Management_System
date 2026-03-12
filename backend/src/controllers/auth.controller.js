import { dbQuery, isMysqlEnabled } from "../config/db.js";
import { nowIso } from "../utils/helpers.js";

export function createAuthController({ authTokens, users, sessions, appendUserActivity, nextSessionId }) {
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
             WHERE LOWER(u.email) = LOWER(?)
             LIMIT 1`,
            [String(email || "").trim()]
          );
          const row = rows[0];
          if (!row) {
            if (isMysqlEnabled()) return res.status(401).json({ message: "Invalid email or password" });
          } else {
            const pass = String(password || "");
            const stored = String(row.password_hash || "");
            const demoHashCompat = stored.startsWith("$2b$10$demo.hash") && pass === "123456";
            if (pass !== stored && !demoHashCompat) return res.status(401).json({ message: "Invalid email or password" });
            if (row.locked) return res.status(403).json({ message: "Account is locked" });

            const token = `demo-token-${row.id}-${Date.now()}`;
            authTokens.set(token, Number(row.id));
            await dbQuery("UPDATE users SET last_login = NOW() WHERE id = ?", [row.id]);
            await dbQuery(
              "INSERT INTO user_sessions (user_id, device, ip, started_at, active) VALUES (?, ?, ?, NOW(), 1)",
              [row.id, "Web Browser", req.ip]
            );
            await dbQuery(
              "INSERT INTO auth_tokens (user_id, token_hash, issued_at, expires_at) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))",
              [row.id, token]
            );
            await dbQuery(
              "INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'LOGIN', ?, NOW())",
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
          console.error("mysql login failed:", err.message);
        }
      }

      const user = users.find(
        (u) => u.email.toLowerCase() === String(email || "").toLowerCase() && u.password === password
      );
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      if (user.locked) return res.status(403).json({ message: "Account is locked" });

      const token = `demo-token-${user.id}-${Date.now()}`;
      authTokens.set(token, user.id);
      user.last_login = nowIso();
      sessions.push({
        id: nextSessionId(),
        user_id: user.id,
        device: "Web Browser",
        ip: req.ip,
        started_at: nowIso(),
        active: true
      });
      appendUserActivity("LOGIN", user.username);
      return res.json({
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            role_name: user.role_name
          }
        }
      });
    },

    async logout(req, res) {
      const authHeader = req.header("authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (isMysqlEnabled() && token) {
        try {
          await dbQuery("UPDATE auth_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL", [token]);
          await dbQuery(
            "INSERT INTO user_activity_logs (user_id, action, detail, created_at) VALUES (?, 'LOGOUT', ?, NOW())",
            [req.user?.id || null, req.user?.username || "unknown"]
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("mysql logout failed:", err.message);
        }
      }
      if (token && token !== "demo-token") authTokens.delete(token);
      appendUserActivity("LOGOUT", req.user?.username || "unknown");
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
