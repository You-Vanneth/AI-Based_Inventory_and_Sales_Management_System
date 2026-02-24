import { z } from "zod";

export const createRoleSchema = z.object({
  role_code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/),
  role_name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(255).nullable().optional(),
  permission_keys: z.array(z.string().trim().min(3).max(100)).default([]).transform((keys) => [...new Set(keys)])
});

export const updateRoleSchema = z.object({
  role_name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
  permission_keys: z.array(z.string().trim().min(3).max(100)).optional().transform((keys) => (
    Array.isArray(keys) ? [...new Set(keys)] : undefined
  ))
});
