import { runPythonJson } from "../utils/python.js";
import { daysUntil, nowIso, toNumber } from "../utils/helpers.js";
import { decryptSecret } from "../utils/crypto.js";

function asBool(value) {
  return Number(value || 0) === 1 || value === true;
}

function normalizeRecipients(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function getPriorityByType(type) {
  switch (type) {
    case "CRITICAL_STOCK":
      return "CRITICAL";
    case "LOW_STOCK":
    case "EXPIRY_7D":
      return "HIGH";
    case "EXPIRY_30D":
    case "REORDER_AI":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function createNotificationService({
  dbQuery,
  isMysqlEnabled,
  notifications,
  nextNotificationId,
  emailSettingsRef
}) {
  async function getNotificationPreferences() {
    if (isMysqlEnabled()) {
      const row = (await dbQuery("SELECT * FROM notification_preferences ORDER BY id LIMIT 1"))[0];
      return row
        ? {
            role_code: row.role_code,
            channel_in_app: asBool(row.channel_in_app),
            channel_email: asBool(row.channel_email),
            low_stock_threshold: toNumber(row.low_stock_threshold, 10),
            expiry_window_days: toNumber(row.expiry_window_days, 7),
            dedup_minutes: toNumber(row.dedup_minutes, 30),
            suppression_enabled: asBool(row.suppression_enabled)
          }
        : {
            channel_in_app: true,
            channel_email: true,
            low_stock_threshold: 10,
            expiry_window_days: 7,
            dedup_minutes: 30,
            suppression_enabled: true
          };
    }

    const pref = emailSettingsRef?.notificationPreferences || {};
    return {
      channel_in_app: pref.channel_in_app !== false,
      channel_email: pref.channel_email !== false,
      low_stock_threshold: toNumber(pref.low_stock_threshold, 10),
      expiry_window_days: toNumber(pref.expiry_window_days, 7),
      dedup_minutes: toNumber(pref.dedup_minutes, 30),
      suppression_enabled: pref.suppression_enabled !== false
    };
  }

  async function getRule(type) {
    if (isMysqlEnabled()) {
      const row = (
        await dbQuery("SELECT * FROM notification_rules WHERE rule_code = ? LIMIT 1", [type])
      )[0];
      if (row) {
        return {
          rule_code: row.rule_code,
          severity: row.severity,
          channel: row.channel,
          active: asBool(row.active)
        };
      }
    }

    const fallbackRules = emailSettingsRef?.notificationRules || [];
    const row = fallbackRules.find((item) => item.rule === type || item.rule_code === type);
    return row
      ? {
          rule_code: type,
          severity: row.severity || getPriorityByType(type),
          channel: row.channel || "IN_APP",
          active: row.active !== false
        }
      : {
          rule_code: type,
          severity: getPriorityByType(type),
          channel: type === "REORDER_AI" ? "IN_APP" : "IN_APP + EMAIL",
          active: true
        };
  }

  async function getEmailSettings() {
    if (isMysqlEnabled()) {
      const row = (await dbQuery("SELECT * FROM email_settings ORDER BY id LIMIT 1"))[0];
      if (!row) return null;
      const recipients = await dbQuery(
        "SELECT recipient_email FROM email_recipients WHERE email_setting_id = ? ORDER BY id ASC",
        [row.id]
      );
      return {
        smtp_host: row.smtp_host,
        smtp_port: toNumber(row.smtp_port, 587),
        smtp_user: row.smtp_user,
        smtp_password: decryptSecret(row.smtp_password, process.env.SMTP_ENCRYPTION_KEY || process.env.AUTH_TOKEN_SECRET || process.env.AUTH_SECRET || ""),
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        use_tls: asBool(row.use_tls),
        alert_expiry_days: toNumber(row.alert_expiry_days, 7),
        alert_low_stock_enabled: asBool(row.alert_low_stock_enabled),
        alert_expiry_enabled: asBool(row.alert_expiry_enabled),
        alert_recipients: recipients.map((item) => item.recipient_email)
      };
    }

    const settings = emailSettingsRef?.emailSettings || null;
    if (!settings) return null;
    return {
      ...settings,
      smtp_password: decryptSecret(
        settings.smtp_password,
        process.env.SMTP_ENCRYPTION_KEY || process.env.AUTH_TOKEN_SECRET || process.env.AUTH_SECRET || ""
      )
    };
  }

  async function shouldSuppress(type, productId, dedupMinutes) {
    if (!productId || dedupMinutes < 1) return false;
    if (isMysqlEnabled()) {
      const rows = await dbQuery(
        `SELECT id
         FROM notifications
         WHERE notification_type = ?
           AND product_id = ?
           AND notification_time >= (NOW() - (? * INTERVAL '1 minute'))
         ORDER BY id DESC
         LIMIT 1`,
        [type, productId, dedupMinutes]
      );
      return Boolean(rows[0]);
    }
    const cutoff = Date.now() - dedupMinutes * 60 * 1000;
    return notifications.some(
      (item) =>
        item.type === type &&
        Number(item.product_id || 0) === Number(productId) &&
        new Date(item.time).getTime() >= cutoff
    );
  }

  async function sendEmail({ recipients, subject, text, category }) {
    const settings = await getEmailSettings();
    if (!settings) return { ok: false, skipped: true, reason: "Email settings not configured" };
    const to = normalizeRecipients(recipients?.length ? recipients : settings.alert_recipients);
    if (!to.length) return { ok: false, skipped: true, reason: "No email recipients configured" };
    if (!settings.smtp_host || !settings.smtp_port || !settings.sender_email) {
      return { ok: false, skipped: true, reason: "SMTP host, port, or sender email is missing" };
    }
    if (category === "LOW_STOCK" && !settings.alert_low_stock_enabled) {
      return { ok: false, skipped: true, reason: "Low stock email alerts disabled" };
    }
    if ((category === "EXPIRY_7D" || category === "EXPIRY_30D") && !settings.alert_expiry_enabled) {
      return { ok: false, skipped: true, reason: "Expiry email alerts disabled" };
    }

    const result = await runPythonJson("smtp_send.py", {
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: settings.smtp_password,
      sender_name: settings.sender_name,
      sender_email: settings.sender_email,
      use_tls: settings.use_tls,
      to,
      subject,
      text
    });
    return { ok: true, ...result };
  }

  async function createNotification({
    type,
    productId = null,
    productName = "-",
    message,
    sourceLink = "/notifications",
    priority,
    channel
  }) {
    const preferences = await getNotificationPreferences();
    const rule = await getRule(type);
    if (!rule.active) return { skipped: true, reason: "Notification rule is disabled" };
    if (preferences.suppression_enabled && (await shouldSuppress(type, productId, preferences.dedup_minutes))) {
      return { skipped: true, reason: "Suppressed duplicate notification" };
    }

    const nextPriority = priority || rule.severity || getPriorityByType(type);
    const nextChannel = channel || rule.channel || "IN_APP";
    const wantsEmail = String(nextChannel).includes("EMAIL") && preferences.channel_email;
    let deliveryStatus = wantsEmail ? "PENDING" : "SENT";

    if (isMysqlEnabled()) {
      const insert = await dbQuery(
        `INSERT INTO notifications
         (notification_time, notification_type, priority, product_id, message, channel, delivery_status, is_read, acknowledged, source_link)
         VALUES (NOW(), ?, ?, ?, ?, ?, ?, FALSE, FALSE, ?)`,
        [type, nextPriority, productId, String(message || ""), nextChannel, deliveryStatus, sourceLink]
      );

      if (wantsEmail) {
        try {
          const subject = `[AI Inventory] ${type.replace(/_/g, " ")} - ${productName}`;
          const emailResult = await sendEmail({
            subject,
            text: `${message}\n\nProduct: ${productName}\nSource: ${sourceLink}\nGenerated at: ${nowIso()}`,
            category: type
          });
          deliveryStatus = emailResult.ok ? "SENT" : emailResult.skipped ? "PENDING" : "FAILED";
        } catch (_err) {
          deliveryStatus = "FAILED";
        }
        await dbQuery("UPDATE notifications SET delivery_status = ? WHERE id = ?", [deliveryStatus, insert.insertId]);
      }

      return {
        id: insert.insertId,
        type,
        priority: nextPriority,
        channel: nextChannel,
        delivery_status: deliveryStatus
      };
    }

    notifications.unshift({
      id: nextNotificationId(),
      time: nowIso(),
      type,
      product: productName,
      product_id: productId,
      priority: nextPriority,
      message,
      channel: nextChannel,
      delivery_status: deliveryStatus,
      read: false,
      acknowledged: false,
      snoozed_until: "-",
      source_link: sourceLink,
      read_by: "-",
      read_at: "-"
    });
    return { id: notifications[0].id, type, priority: nextPriority, channel: nextChannel, delivery_status: deliveryStatus };
  }

  async function resolveProductById(productId, products = []) {
    if (!productId) return null;
    if (isMysqlEnabled()) {
      const rows = await dbQuery(
        `SELECT p.*, c.name_en AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [productId]
      );
      return rows[0] || null;
    }
    return products.find((item) => Number(item.id) === Number(productId)) || null;
  }

  async function scanProductAlerts({ productId, product = null, sourceLink = "/inventory-health", products = [] }) {
    const target = product || (await resolveProductById(productId, products));
    if (!target) return [];
    const created = [];
    const lowThreshold = toNumber(target.min_stock_level, 0);
    const quantity = toNumber(target.quantity, 0);
    if (quantity <= lowThreshold && lowThreshold > 0) {
      const type = quantity <= 0 ? "CRITICAL_STOCK" : "LOW_STOCK";
      created.push(
        await createNotification({
          type,
          productId: target.id,
          productName: target.product_name,
          message: `Stock is below minimum threshold (${quantity}/${lowThreshold}).`,
          sourceLink
        })
      );
    }

    const expiryDays = daysUntil(target.expiry_date);
    if (expiryDays !== null && expiryDays <= 30) {
      created.push(
        await createNotification({
          type: expiryDays <= 7 ? "EXPIRY_7D" : "EXPIRY_30D",
          productId: target.id,
          productName: target.product_name,
          message:
            expiryDays <= 7
              ? `Product expires within ${Math.max(0, expiryDays)} day(s).`
              : `Product expires within ${Math.max(0, expiryDays)} day(s).`,
          sourceLink
        })
      );
    }

    return created.filter(Boolean);
  }

  return {
    createNotification,
    getEmailSettings,
    sendEmail,
    scanProductAlerts
  };
}
