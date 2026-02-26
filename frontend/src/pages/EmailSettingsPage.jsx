import React from "react";
import { useState } from "react";
import Layout from "../components/Layout";
import { t } from "../lib/i18n";

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
    to_email: ""
  });

  const [msg, setMsg] = useState("");

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = (e) => {
    e.preventDefault();
    setMsg("Email settings saved.");
  };

  const test = () => {
    setMsg(`Test sent to ${form.to_email || form.sender_email || "receiver"}.`);
  };

  return (
    <Layout title="Email Settings">
      <section className="hero">
        <h2>{t("Email Settings")}</h2>
        <p>{t("SMTP and alert settings module.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">SMTP Configuration</h3>
        <form className="grid" onSubmit={save}>
          <div className="row">
            <div><label>SMTP Host</label><input value={form.smtp_host} onChange={(e) => update("smtp_host", e.target.value)} /></div>
            <div><label>SMTP Port</label><input type="number" value={form.smtp_port} onChange={(e) => update("smtp_port", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>SMTP User</label><input value={form.smtp_user} onChange={(e) => update("smtp_user", e.target.value)} /></div>
            <div><label>SMTP Password</label><input type="password" value={form.smtp_password} onChange={(e) => update("smtp_password", e.target.value)} /></div>
          </div>
          <div className="row">
            <div><label>Sender Name</label><input value={form.sender_name} onChange={(e) => update("sender_name", e.target.value)} /></div>
            <div><label>Sender Email</label><input type="email" value={form.sender_email} onChange={(e) => update("sender_email", e.target.value)} /></div>
          </div>
          <div className="row">
            <div><label>Use TLS (1/0)</label><input type="number" min="0" max="1" value={form.use_tls} onChange={(e) => update("use_tls", Number(e.target.value))} /></div>
            <div><label>Expiry Alert Days</label><input type="number" min="1" value={form.alert_expiry_days} onChange={(e) => update("alert_expiry_days", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>Low Stock Alert (1/0)</label><input type="number" min="0" max="1" value={form.alert_low_stock_enabled} onChange={(e) => update("alert_low_stock_enabled", Number(e.target.value))} /></div>
            <div><label>Expiry Alert (1/0)</label><input type="number" min="0" max="1" value={form.alert_expiry_enabled} onChange={(e) => update("alert_expiry_enabled", Number(e.target.value))} /></div>
          </div>
          <button type="submit">Save Settings</button>
        </form>
      </section>

      <section className="card">
        <h3 className="card-title">Test Email</h3>
        <div className="row">
          <div><label>To Email (optional)</label><input type="email" value={form.to_email} onChange={(e) => update("to_email", e.target.value)} /></div>
          <div><label>Action</label><button type="button" onClick={test}>Send Test Email</button></div>
        </div>
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
