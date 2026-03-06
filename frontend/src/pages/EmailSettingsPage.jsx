import React from "react";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { t } from "../lib/i18n";
import { apiFetch } from "../lib/api";

export default function EmailSettingsPage() {
  const [form, setForm] = useState({
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    sender_name: "AI Inventory",
    sender_email: "",
    use_tls: 1,
    alert_expiry_days: 7,
    alert_low_stock_enabled: 1,
    alert_expiry_enabled: 1,
    to_email: "",
    alert_recipients: [""]
  });

  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/email-settings")
      .then((res) => {
        if (res?.data) {
          setForm((prev) => ({
            ...prev,
            ...res.data,
            to_email: prev.to_email || "",
            alert_recipients: Array.isArray(res.data.alert_recipients) && res.data.alert_recipients.length
              ? res.data.alert_recipients
              : [""]
          }));
        }
      })
      .catch(() => {});
  }, []);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const updateRecipient = (index, value) =>
    setForm((prev) => ({
      ...prev,
      alert_recipients: prev.alert_recipients.map((r, i) => (i === index ? value : r))
    }));

  const addRecipient = () => {
    setForm((prev) => {
      if (prev.alert_recipients.length >= 5) return prev;
      return { ...prev, alert_recipients: [...prev.alert_recipients, ""] };
    });
  };

  const removeRecipient = (index) => {
    setForm((prev) => {
      const next = prev.alert_recipients.filter((_, i) => i !== index);
      return { ...prev, alert_recipients: next.length ? next : [""] };
    });
  };

  const validRecipients = form.alert_recipients
    .map((x) => x.trim())
    .filter((x) => x && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));

  const save = async (e) => {
    e.preventDefault();
    if (validRecipients.length > 5) {
      setMsg(t("Maximum 5 recipients are allowed."));
      return;
    }
    try {
      await apiFetch("/email-settings", {
        method: "PUT",
        body: JSON.stringify({ ...form, alert_recipients: validRecipients })
      });
      setMsg(t("Email settings saved."));
    } catch (err) {
      setMsg(`Save failed: ${err.message}`);
    }
  };

  const test = async () => {
    const recipients = validRecipients.length
      ? validRecipients.join(", ")
      : form.to_email || form.sender_email || t("receiver");
    try {
      await apiFetch("/email-settings/test", {
        method: "POST",
        body: JSON.stringify({ to: validRecipients.length ? validRecipients : recipients })
      });
      setMsg(`${t("Test sent to")} ${recipients}.`);
    } catch (err) {
      setMsg(`${t("Test failed")}: ${err.message}`);
    }
  };

  return (
    <Layout title="Email Settings">
      <section className="hero">
        <h2>{t("Email Settings")}</h2>
        <p>{t("SMTP and alert settings module.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">{t("SMTP Configuration")}</h3>
        <form className="grid" onSubmit={save}>
          <div className="row">
            <div><label>{t("SMTP Host")}</label><input value={form.smtp_host} onChange={(e) => update("smtp_host", e.target.value)} /></div>
            <div><label>{t("SMTP Port")}</label><input type="number" value={form.smtp_port} onChange={(e) => update("smtp_port", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>{t("SMTP User")}</label><input value={form.smtp_user} onChange={(e) => update("smtp_user", e.target.value)} /></div>
            <div><label>{t("SMTP Password")}</label><input type="password" value={form.smtp_password} onChange={(e) => update("smtp_password", e.target.value)} /></div>
          </div>
          <div className="row">
            <div><label>{t("Sender Name")}</label><input value={form.sender_name} onChange={(e) => update("sender_name", e.target.value)} /></div>
            <div><label>{t("Sender Email")}</label><input type="email" value={form.sender_email} onChange={(e) => update("sender_email", e.target.value)} /></div>
          </div>
          <div className="row">
            <div><label>{t("Use TLS (1/0)")}</label><input type="number" min="0" max="1" value={form.use_tls} onChange={(e) => update("use_tls", Number(e.target.value))} /></div>
            <div><label>{t("Expiry Alert Days")}</label><input type="number" min="1" value={form.alert_expiry_days} onChange={(e) => update("alert_expiry_days", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>{t("Low Stock Alert (1/0)")}</label><input type="number" min="0" max="1" value={form.alert_low_stock_enabled} onChange={(e) => update("alert_low_stock_enabled", Number(e.target.value))} /></div>
            <div><label>{t("Expiry Alert (1/0)")}</label><input type="number" min="0" max="1" value={form.alert_expiry_enabled} onChange={(e) => update("alert_expiry_enabled", Number(e.target.value))} /></div>
          </div>
          <div className="grid">
            <div className="card-head">
              <label>{t("Alert Recipients (Max 5)")}</label>
              <button
                type="button"
                className="btn-inline secondary"
                onClick={addRecipient}
                disabled={form.alert_recipients.length >= 5}
              >
                {t("Add Recipient")}
              </button>
            </div>
            {form.alert_recipients.map((email, idx) => (
              <div className="row email-recipient-row" key={`recipient-${idx}`}>
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateRecipient(idx, e.target.value)}
                    placeholder={`${t("recipient")}${idx + 1}@example.com`}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeRecipient(idx)}
                    disabled={form.alert_recipients.length === 1}
                  >
                    {t("Remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="submit">{t("Save Settings")}</button>
        </form>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Test Email")}</h3>
        <div className="row">
          <div><label>{t("To Email (optional)")}</label><input type="email" value={form.to_email} onChange={(e) => update("to_email", e.target.value)} /></div>
          <div><label>{t("Action")}</label><button type="button" onClick={test}>{t("Send Test Email")}</button></div>
        </div>
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
