import { fail, ok } from "../../utils/http.js";
import { sendTestEmailSchema, upsertEmailSettingsSchema } from "./email-settings.validator.js";
import { getLatestEmailSettings, sendTestEmail, upsertEmailSettings } from "./email-settings.service.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function getSettings(req, res) {
  const data = await getLatestEmailSettings();
  return ok(res, data || {}, "Email settings fetched");
}

export async function updateSettings(req, res) {
  const parsed = upsertEmailSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));
  }

  const data = await upsertEmailSettings(parsed.data, req.user.user_id);
  return ok(res, data, "Email settings saved");
}

export async function testEmail(req, res, next) {
  const parsed = sendTestEmailSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));
  }

  try {
    const data = await sendTestEmail(parsed.data.to_email);
    return ok(res, data, "Test email sent");
  } catch (error) {
    return next(error);
  }
}
