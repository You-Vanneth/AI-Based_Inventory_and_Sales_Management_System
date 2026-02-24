import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { getTokenExpiresInSeconds } from "../src/modules/auth/auth.controller.js";

test("getTokenExpiresInSeconds returns token TTL in seconds", () => {
  const token = jwt.sign({ user_id: 1 }, "test-secret", { expiresIn: "2h" });
  const expiresIn = getTokenExpiresInSeconds(token);
  assert.equal(expiresIn, 7200);
});

test("getTokenExpiresInSeconds returns null for invalid token payload", () => {
  const expiresIn = getTokenExpiresInSeconds("invalid.token.value");
  assert.equal(expiresIn, null);
});
