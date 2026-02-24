import { z } from "zod";

const moneyField = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v >= 0, "Must be a non-negative number");

export const createProductSchema = z.object({
  product_name: z.string().trim().min(2).max(190),
  barcode: z.string().trim().min(3).max(80),
  category_id: z.number().int().positive(),
  quantity: z.number().int().min(0).default(0),
  min_stock_level: z.number().int().min(0).default(5),
  cost_price: moneyField,
  selling_price: moneyField,
  expiry_date: z.string().date().optional().nullable()
});

export const updateProductSchema = z.object({
  product_name: z.string().trim().min(2).max(190).optional(),
  barcode: z.string().trim().min(3).max(80).optional(),
  category_id: z.number().int().positive().optional(),
  min_stock_level: z.number().int().min(0).optional(),
  cost_price: moneyField.optional(),
  selling_price: moneyField.optional(),
  expiry_date: z.string().date().optional().nullable(),
  is_active: z.number().int().min(0).max(1).optional()
});

export const stockAdjustmentSchema = z.object({
  adjustment_type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(3).max(255)
});
