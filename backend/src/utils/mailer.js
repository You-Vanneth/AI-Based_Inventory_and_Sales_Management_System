function decodeSecret(value) {
  return Buffer.from(value || "", "base64").toString("utf8");
}

function isResendEnabled() {
  const provider = String(process.env.EMAIL_PROVIDER || "auto").toLowerCase();
  if (provider === "resend") return true;
  if (provider === "smtp") return false;
  return Boolean(process.env.RESEND_API_KEY);
}

function getFromIdentity(settings) {
  const senderName = settings?.sender_name || process.env.RESEND_FROM_NAME || "AI Inventory System";
  const senderEmail = settings?.sender_email || process.env.RESEND_FROM_EMAIL || "";
  return { senderName, senderEmail };
}

function buildSmtpTransportConfig(settings) {
  const port = Number(settings.smtp_port);
  const tlsEnabled = Number(settings.use_tls) === 1;
  const secure = tlsEnabled && port === 465;

  return {
    host: settings.smtp_host,
    port,
    secure,
    requireTLS: tlsEnabled && port !== 465,
    auth: {
      user: settings.smtp_user,
      pass: decodeSecret(settings.smtp_password_encrypted)
    }
  };
}

async function sendViaResend({ settings, to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const err = new Error("RESEND_API_KEY is not configured");
    err.statusCode = 400;
    err.errorCode = "RESEND_NOT_CONFIGURED";
    throw err;
  }

  const { senderName, senderEmail } = getFromIdentity(settings);
  if (!senderEmail) {
    const err = new Error("Sender email is missing. Set sender_email in Email Settings or RESEND_FROM_EMAIL in .env");
    err.statusCode = 400;
    err.errorCode = "SENDER_EMAIL_MISSING";
    throw err;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `"${senderName}" <${senderEmail}>`,
      to: [to],
      subject,
      text,
      html
    })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(body?.message || body?.error || "Resend send failed");
    err.statusCode = 400;
    err.errorCode = "RESEND_SEND_FAILED";
    throw err;
  }

  return {
    provider: "resend",
    message_id: body?.id,
    accepted: [to],
    rejected: []
  };
}

async function sendViaSmtp({ settings, to, subject, text, html }) {
  if (!settings) {
    const err = new Error("Email settings not configured");
    err.statusCode = 404;
    err.errorCode = "EMAIL_SETTINGS_NOT_FOUND";
    throw err;
  }

  let nodemailer;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    const err = new Error("nodemailer dependency is missing. Run npm install nodemailer");
    err.statusCode = 500;
    err.errorCode = "NODEMAILER_MISSING";
    throw err;
  }

  const transporter = nodemailer.default.createTransport(buildSmtpTransportConfig(settings));

  try {
    const info = await transporter.sendMail({
      from: `"${settings.sender_name}" <${settings.sender_email}>`,
      to,
      subject,
      text,
      html
    });

    return {
      provider: "smtp",
      message_id: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    const err = new Error(
      error?.response ||
      error?.message ||
      "Failed to send email. Please verify SMTP host, port, username, password, and TLS setting."
    );
    err.statusCode = 400;
    err.errorCode = "SMTP_SEND_FAILED";
    throw err;
  }
}

export async function sendMail({ settings, to, subject, text, html }) {
  if (isResendEnabled()) {
    return sendViaResend({ settings, to, subject, text, html });
  }
  return sendViaSmtp({ settings, to, subject, text, html });
}
