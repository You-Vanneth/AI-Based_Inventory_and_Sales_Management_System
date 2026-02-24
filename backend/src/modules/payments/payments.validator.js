import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v > 0, "Must be a positive number");

export const addPaymentSchema = z.object({
  payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "E_WALLET", "OTHER"]),
  amount: money,
  reference_no: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable()
});
