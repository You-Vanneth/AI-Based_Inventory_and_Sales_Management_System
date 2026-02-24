import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v >= 0, "Must be a non-negative number");

export const createPurchaseOrderSchema = z.object({
  po_number: z.string().trim().min(3).max(60),
  supplier_name: z.string().trim().min(2).max(190),
  supplier_phone: z.string().trim().max(40).optional().nullable(),
  supplier_email: z.string().trim().email().max(190).optional().nullable(),
  order_date: z.string().date(),
  expected_date: z.string().date().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity_ordered: z.number().int().positive(),
      unit_cost: money,
      expiry_date: z.string().date().optional().nullable()
    })
  ).min(1)
});

export const updatePurchaseOrderSchema = z.object({
  supplier_name: z.string().trim().min(2).max(190).optional(),
  supplier_phone: z.string().trim().max(40).optional().nullable(),
  supplier_email: z.string().trim().email().max(190).optional().nullable(),
  expected_date: z.string().date().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable()
});

export const receivePurchaseOrderSchema = z.object({
  received_date: z.string().date(),
  items: z.array(
    z.object({
      purchase_order_item_id: z.number().int().positive(),
      quantity_received: z.number().int().positive(),
      expiry_date: z.string().date().optional().nullable()
    })
  ).min(1)
});
