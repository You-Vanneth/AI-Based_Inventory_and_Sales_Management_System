import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole } from "../src/middlewares/auth.js";
import { env } from "../src/config/env.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("requireAuth rejects missing Authorization header", () => {
  const req = { headers: {} };
  const res = createMockRes();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error_code, "UNAUTHORIZED");
});

test("requireAuth accepts valid JWT", () => {
  const token = jwt.sign({ user_id: 1, role: "ADMIN", email: "a@b.com" }, env.jwtSecret, { expiresIn: "1h" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createMockRes();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "ADMIN");
});

test("requireRole blocks non-authorized role", () => {
  const guard = requireRole("ADMIN");
  const req = { user: { role: "STAFF" } };
  const res = createMockRes();
  let nextCalled = false;

  guard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error_code, "FORBIDDEN");
});
