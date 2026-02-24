import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v >= 0, "Must be a non-negative number");

export const createSaleSchema = z.object({
  sale_datetime: z.string().datetime().optional(),
  notes: z.string().trim().max(255).optional().nullable(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity_sold: z.number().int().positive(),
      unit_price: money,
      discount_amount: money.optional().default(0)
    })
  ).min(1).superRefine((items, ctx) => {
    const seen = new Set();
    items.forEach((item, index) => {
      if (seen.has(item.product_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "product_id"],
          message: "Duplicate product_id in sale items is not allowed"
        });
        return;
      }
      seen.add(item.product_id);
    });
  }),
  payments: z.array(
    z.object({
      payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "E_WALLET", "OTHER"]),
      amount: money,
      reference_no: z.string().trim().max(120).optional().nullable(),
      note: z.string().trim().max(255).optional().nullable()
    })
  ).optional().default([])
});
