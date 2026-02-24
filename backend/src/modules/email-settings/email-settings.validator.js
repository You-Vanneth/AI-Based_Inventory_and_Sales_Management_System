import { z } from "zod";

export const upsertEmailSettingsSchema = z.object({
  smtp_host: z.string().trim().min(2).max(190),
  smtp_port: z.number().int().positive(),
  smtp_user: z.string().trim().min(1).max(190),
  smtp_password: z.string().min(1).max(255),
  sender_name: z.string().trim().min(2).max(120),
  sender_email: z.string().trim().email().max(190),
  use_tls: z.number().int().min(0).max(1).default(1),
  alert_expiry_days: z.number().int().min(1).max(365).default(7),
  alert_low_stock_enabled: z.number().int().min(0).max(1).default(1),
  alert_expiry_enabled: z.number().int().min(0).max(1).default(1)
});

export const sendTestEmailSchema = z.object({
  to_email: z.string().trim().email().max(190).optional()
});
