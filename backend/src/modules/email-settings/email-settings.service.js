import { pool } from "../../db/pool.js";
import { sendMail } from "../../utils/mailer.js";

function encodeSecret(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function getLatestEmailSettings() {
  const [rows] = await pool.query(
    `SELECT email_setting_id, smtp_host, smtp_port, smtp_user,
            smtp_password_encrypted, sender_name, sender_email, use_tls,
            alert_expiry_days, alert_low_stock_enabled, alert_expiry_enabled,
            updated_by, created_at, updated_at
     FROM email_settings
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, email_setting_id DESC
     LIMIT 1`
  );

  const row = rows[0] || null;
  if (!row) return null;

  return {
    ...row,
    smtp_password_masked: "********"
  };
}

export async function upsertEmailSettings(payload, actorId) {
  const [rows] = await pool.query(
    `SELECT email_setting_id
     FROM email_settings
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, email_setting_id DESC
     LIMIT 1`
  );

  const encrypted = encodeSecret(payload.smtp_password);
  const existing = rows[0];

  if (existing) {
    await pool.query(
      `UPDATE email_settings
       SET smtp_host = ?, smtp_port = ?, smtp_user = ?,
           smtp_password_encrypted = ?, sender_name = ?, sender_email = ?,
           use_tls = ?, alert_expiry_days = ?, alert_low_stock_enabled = ?,
           alert_expiry_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE email_setting_id = ?`,
      [
        payload.smtp_host,
        payload.smtp_port,
        payload.smtp_user,
        encrypted,
        payload.sender_name,
        payload.sender_email,
        payload.use_tls,
        payload.alert_expiry_days,
        payload.alert_low_stock_enabled,
        payload.alert_expiry_enabled,
        actorId,
        existing.email_setting_id
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO email_settings (
        smtp_host, smtp_port, smtp_user, smtp_password_encrypted,
        sender_name, sender_email, use_tls, alert_expiry_days,
        alert_low_stock_enabled, alert_expiry_enabled, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.smtp_host,
        payload.smtp_port,
        payload.smtp_user,
        encrypted,
        payload.sender_name,
        payload.sender_email,
        payload.use_tls,
        payload.alert_expiry_days,
        payload.alert_low_stock_enabled,
        payload.alert_expiry_enabled,
        actorId
      ]
    );
  }

  return getLatestEmailSettings();
}

export async function sendTestEmail(toEmail) {
  const [rows] = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_password_encrypted,
            sender_name, sender_email, use_tls
     FROM email_settings
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, email_setting_id DESC
     LIMIT 1`
  );

  const settings = rows[0] || null;
  const receiver = toEmail || settings?.sender_email || process.env.ALERT_TO_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!receiver) {
    const err = new Error("Receiver email is required. Provide to_email or configure sender_email / ALERT_TO_EMAIL / RESEND_FROM_EMAIL");
    err.statusCode = 400;
    err.errorCode = "RECEIVER_EMAIL_MISSING";
    throw err;
  }

  const info = await sendMail({
    settings,
    to: receiver,
    subject: "AI Inventory System - Test Email",
    text: "This is a test email from AI Inventory System.",
    html: "<p>This is a test email from <strong>AI Inventory System</strong>.</p>"
  });

  return {
    message_id: info.message_id,
    provider: info.provider,
    accepted: info.accepted,
    rejected: info.rejected,
    to: receiver
  };
}
