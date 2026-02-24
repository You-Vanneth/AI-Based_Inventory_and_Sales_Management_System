import test from "node:test";
import assert from "node:assert/strict";
import { ok, created, fail } from "../src/utils/http.js";

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

test("ok() returns standard success envelope", () => {
  const res = createMockRes();
  ok(res, { x: 1 }, "done", { page: 1, limit: 20, total: 1 });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "done");
  assert.deepEqual(res.body.data, { x: 1 });
  assert.deepEqual(res.body.meta, { page: 1, limit: 20, total: 1 });
});

test("created() returns 201 envelope", () => {
  const res = createMockRes();
  created(res, { id: 10 }, "created");

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "created");
  assert.deepEqual(res.body.data, { id: 10 });
});

test("fail() returns error envelope", () => {
  const res = createMockRes();
  fail(res, 422, "Validation failed", "VALIDATION_ERROR", [{ field: "email", message: "invalid" }]);

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error_code, "VALIDATION_ERROR");
  assert.equal(res.body.errors.length, 1);
});
