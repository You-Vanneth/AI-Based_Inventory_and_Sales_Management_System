import { z } from "zod";

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "STAFF"]).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(190),
  password: z.string().min(8).max(100)
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(8).max(100),
  new_password: z.string().min(8).max(100)
});
