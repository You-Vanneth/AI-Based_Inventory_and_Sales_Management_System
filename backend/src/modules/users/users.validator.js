import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  role_id: z.number().int().positive().optional()
});

export const updateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(190).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  role_id: z.number().int().positive().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
  new_password: z.string().min(8).max(100).optional()
});

export const updateStatusSchema = z.object({
  is_active: z.number().int().min(0).max(1)
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(8).max(100)
});
