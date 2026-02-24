import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema } from "../src/modules/auth/auth.validator.js";
import { createProductSchema } from "../src/modules/products/products.validator.js";
import { createSaleSchema } from "../src/modules/sales/sales.validator.js";

test("loginSchema validates proper payload", () => {
  const result = loginSchema.safeParse({
    email: "admin@local.com",
    password: "Admin@12345"
  });
  assert.equal(result.success, true);
});

test("createProductSchema rejects invalid price", () => {
  const result = createProductSchema.safeParse({
    product_name: "Water",
    barcode: "123456",
    category_id: 1,
    quantity: 2,
    min_stock_level: 1,
    cost_price: -1,
    selling_price: 2
  });

  assert.equal(result.success, false);
});

test("createSaleSchema accepts item and payment", () => {
  const result = createSaleSchema.safeParse({
    items: [
      {
        product_id: 1,
        quantity_sold: 2,
        unit_price: 3.5,
        discount_amount: 0
      }
    ],
    payments: [
      {
        payment_method: "CASH",
        amount: 7
      }
    ]
  });

  assert.equal(result.success, true);
});

test("createSaleSchema rejects duplicate product_id entries", () => {
  const result = createSaleSchema.safeParse({
    items: [
      {
        product_id: 1,
        quantity_sold: 1,
        unit_price: 5,
        discount_amount: 0
      },
      {
        product_id: 1,
        quantity_sold: 2,
        unit_price: 5,
        discount_amount: 0
      }
    ]
  });

  assert.equal(result.success, false);
});
