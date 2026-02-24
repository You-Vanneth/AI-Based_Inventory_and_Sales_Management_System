import test from "node:test";
import assert from "node:assert/strict";

const RUN = process.env.RUN_API_INTEGRATION === "1";
const BASE_URL = process.env.API_BASE_URL || "http://localhost:5001";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@local.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Admin@12345";

let token = "";

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test("integration mode is enabled", { skip: !RUN }, () => {
  assert.equal(RUN, true);
});

test("health endpoint responds", { skip: !RUN }, async () => {
  const { status, body } = await jsonFetch("/api/v1/health");
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test("login returns bearer token", { skip: !RUN }, async () => {
  const { status, body } = await jsonFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data?.access_token);
  token = body.data.access_token;
});

test("dashboard summary returns expected fields", { skip: !RUN }, async () => {
  const { status, body } = await jsonFetch("/api/v1/dashboard/summary", {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Object.hasOwn(body.data, "total_products"));
  assert.ok(Object.hasOwn(body.data, "total_sales_today"));
  assert.ok(Object.hasOwn(body.data, "monthly_revenue"));
});

test("core list endpoints respond", { skip: !RUN }, async () => {
  const endpoints = [
    "/api/v1/categories?limit=5",
    "/api/v1/products?limit=5",
    "/api/v1/sales?limit=5",
    "/api/v1/purchase-orders?limit=5",
    "/api/v1/inventory-movements?limit=5",
    "/api/v1/reports/sales/daily",
    "/api/v1/reports/sales/monthly",
    "/api/v1/reports/stock/low",
    "/api/v1/reports/stock/expiry",
    "/api/v1/reports/ai/reorder-suggestions",
    "/api/v1/ai/reorder-recommendations"
  ];

  for (const endpoint of endpoints) {
    const { status, body } = await jsonFetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(status, 200, `Expected 200 for ${endpoint}, got ${status}`);
    assert.equal(body.success, true, `Expected success=true for ${endpoint}`);
  }
});
