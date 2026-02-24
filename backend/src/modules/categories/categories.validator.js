import { z } from "zod";

export const createCategorySchema = z.object({
  category_name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(255).optional().nullable()
});

export const updateCategorySchema = z.object({
  category_name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(255).optional().nullable(),
  is_active: z.number().int().min(0).max(1).optional()
});
