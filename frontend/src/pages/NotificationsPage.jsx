import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const seed = [
  {
    id: 1,
    time: "2026-03-05 09:12",
    type: "LOW_STOCK",
    priority: "HIGH",
    product: "Instant Noodle",
    message: "Stock is below minimum threshold (5/12).",
    channel: "IN_APP + EMAIL",
    delivery_status: "SENT",
    read: false,
    acknowledged: false,
    snoozed_until: "-",
    source_link: "/inventory-health",
    read_by: "-",
    read_at: "-"
  },
  {
    id: 2,
    time: "2026-03-05 08:40",
    type: "EXPIRY_7D",
    priority: "HIGH",
    product: "UHT Milk",
    message: "Product expires within 7 days.",
    channel: "IN_APP + EMAIL",
    delivery_status: "FAILED",
    read: false,
    acknowledged: false,
    snoozed_until: "-",
    source_link: "/inventory-health",
    read_by: "-",
    read_at: "-"
  },
  {
    id: 3,
    time: "2026-03-04 17:25",
    type: "REORDER_AI",
    priority: "MEDIUM",
    product: "Coca Cola 330ml",
    message: "AI recommends reorder quantity +26.",
    channel: "IN_APP",
    delivery_status: "SENT",
    read: true,
    acknowledged: true,
    snoozed_until: "-",
    source_link: "/ai",
    read_by: "Demo Admin",
    read_at: "2026-03-04 17:30"
  }
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(seed);
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [msg, setMsg] = useState("");

  const [prefs, setPrefs] = useState({
    role: "ADMIN",
    channel_in_app: true,
    channel_email: true,
    low_stock_threshold: 12,
    expiry_window_days: 7,
    dedup_minutes: 30,
    suppression_enabled: true
  });

  const [rules, setRules] = useState([
    { id: 1, rule: "LOW_STOCK", severity: "HIGH", channel: "IN_APP + EMAIL", active: true },
    { id: 2, rule: "CRITICAL_STOCK", severity: "CRITICAL", channel: "IN_APP + EMAIL", active: true },
    { id: 3, rule: "EXPIRY_30D", severity: "MEDIUM", channel: "IN_APP", active: true },
    { id: 4, rule: "EXPIRY_7D", severity: "HIGH", channel: "IN_APP + EMAIL", active: true },
    { id: 5, rule: "REORDER_AI", severity: "MEDIUM", channel: "IN_APP", active: true }
  ]);

  const loadNotifications = async () => {
    const qs = new URLSearchParams({ type, status });
    const res = await apiFetch(`/notifications?${qs.toString()}`);
    setItems(Array.isArray(res?.data) ? res.data : []);
  };
  const loadPrefs = async () => {
    const res = await apiFetch("/notifications/preferences");
    if (res?.data) setPrefs(res.data);
  };
  const loadRules = async () => {
    const res = await apiFetch("/notifications/rules");
    setRules(Array.isArray(res?.data) ? res.data : []);
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadNotifications().catch(() => {});
      setLastUpdated(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    loadNotifications().catch(() => {});
    loadPrefs().catch(() => {});
    loadRules().catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications().catch(() => {});
  }, [type, status]);

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const typeOk = type === "ALL" ? true : x.type === type;
      const statusOk =
        status === "ALL"
          ? true
          : status === "READ"
            ? x.read
            : status === "UNREAD"
              ? !x.read
              : status === "FAILED"
                ? x.delivery_status === "FAILED"
                : true;
      return typeOk && statusOk;
    });
  }, [items, status, type]);

  const unread = items.filter((x) => !x.read).length;
  const critical = items.filter((x) => x.priority === "HIGH" && !x.read).length;
  const failed = items.filter((x) => x.delivery_status === "FAILED").length;
  const snoozed = items.filter((x) => x.snoozed_until !== "-").length;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applyToSelection = async (action, doneMessage) => {
    if (!selectedIds.length) {
      setMsg(t("No notifications selected."));
      return;
    }
    try {
      await apiFetch("/notifications/bulk-action", {
        method: "PATCH",
        body: JSON.stringify({ ids: selectedIds, action })
      });
      setSelectedIds([]);
      await loadNotifications();
      setMsg(t(doneMessage));
    } catch (err) {
      setMsg(`${t("Bulk action failed")}: ${err.message}`);
    }
  };

  const markOne = async (id) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      await loadNotifications();
      setMsg(t("Notification marked as read."));
    } catch (err) {
      setMsg(`${t("Mark read failed")}: ${err.message}`);
    }
  };

  const markAll = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      await loadNotifications();
      setMsg(t("All notifications marked as read."));
    } catch (err) {
      setMsg(`${t("Mark-all failed")}: ${err.message}`);
    }
  };

  const retryFailed = async () => {
    const hasFailed = items.some((x) => x.delivery_status === "FAILED");
    if (!hasFailed) {
      setMsg(t("No failed deliveries."));
      return;
    }
    try {
      await apiFetch("/notifications/retry-failed", { method: "POST" });
      await loadNotifications();
      setMsg(t("Retry queue processed."));
    } catch (err) {
      setMsg(`${t("Retry failed")}: ${err.message}`);
    }
  };

  const updatePref = (k, v) => setPrefs((prev) => ({ ...prev, [k]: v }));

  const toggleRule = async (id) => {
    try {
      await apiFetch(`/notifications/rules/${id}/toggle`, { method: "PATCH" });
      await loadRules();
    } catch (err) {
      setMsg(`${t("Toggle rule failed")}: ${err.message}`);
    }
  };

  return (
    <Layout title="Notifications">
      <section className="hero">
        <h2>{t("Notifications Center")}</h2>
        <p>{t("Low stock, expiry, and AI restock recommendations in one queue.")}</p>
        <p className="mt-8">{t("Last updated")}: {lastUpdated.toLocaleTimeString()}</p>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Unread Alerts")}</div><div className="kpi-value">{unread}</div></article>
        <article className="kpi"><div className="kpi-label">{t("High Priority")}</div><div className="kpi-value">{critical}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Failed Email")}</div><div className="kpi-value">{failed}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Snoozed")}</div><div className="kpi-value">{snoozed}</div></article>
      </section>

      <section className="card">
        <div className="row row-wrap notifications-toolbar">
          <div>
            <label>{t("Alert Type")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">{t("ALL")}</option>
              <option value="LOW_STOCK">{t("LOW_STOCK")}</option>
              <option value="EXPIRY_7D">{t("EXPIRY_7D")}</option>
              <option value="REORDER_AI">{t("REORDER_AI")}</option>
            </select>
          </div>
          <div>
            <label>{t("Status")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">{t("ALL")}</option>
              <option value="UNREAD">{t("UNREAD")}</option>
              <option value="READ">{t("READ")}</option>
              <option value="FAILED">{t("FAILED DELIVERY")}</option>
            </select>
          </div>
          <div>
            <label>{t("Realtime Refresh")}</label>
            <select value={autoRefresh ? "ON" : "OFF"} onChange={(e) => setAutoRefresh(e.target.value === "ON")}>
              <option value="ON">{t("ON")}</option>
              <option value="OFF">{t("OFF")}</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={markAll}>{t("Mark All Read")}</button>
          </div>
          <div>
            <label>{t("Retry Queue")}</label>
            <button type="button" className="secondary" onClick={retryFailed}>{t("Retry Failed")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Bulk Actions")}</h3>
        <div className="row row-wrap notifications-bulk">
          <button type="button" onClick={() => applyToSelection("ACKNOWLEDGE", "Selected notifications acknowledged.")}>{t("Acknowledge")}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => applyToSelection("SNOOZE_1H", "Selected notifications snoozed for 1 hour.")}
          >
            {t("Snooze 1h")}
          </button>
          <button type="button" className="secondary" onClick={() => applyToSelection("ESCALATE", "Selected notifications escalated.")}>{t("Escalate")}</button>
          <button type="button" className="secondary" onClick={() => applyToSelection("MARK_READ", "Selected notifications marked as read.")}>{t("Mark Read")}</button>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Alert Queue")}</h3>
        <DataTable
          className="notifications-table"
          columns={[t("Select"), t("Time"), t("Alert"), t("Delivery"), t("Audit"), t("Actions")]}
          rows={filtered.map((x) => [
            <input key={`s-${x.id}`} type="checkbox" checked={selectedIds.includes(x.id)} onChange={() => toggleSelect(x.id)} />,
            x.time,
            <div key={`alert-${x.id}`} className="notif-alert-cell">
              <div className="notif-topline">
                <span className={`chip ${x.priority === "HIGH" ? "danger" : "warning"}`}>{t(x.priority)}</span>
                <strong>{t(x.type)}</strong>
              </div>
              <div className="notif-product">{x.product}</div>
              <div className="notif-message">{t(x.message)}</div>
              <div className="notif-meta">{t(x.channel)}</div>
            </div>,
            <div key={`delivery-${x.id}`} className="notif-delivery">
              <span className={`chip ${x.delivery_status === "FAILED" ? "danger" : ""}`}>{t(x.delivery_status)}</span>
              <span className="notif-meta">{x.snoozed_until !== "-" ? `${t("Snoozed until")} ${x.snoozed_until}` : t("Not snoozed")}</span>
            </div>,
            <div key={`audit-${x.id}`} className="notif-audit">
              <div><strong>{x.read ? t("READ") : t("UNREAD")}</strong></div>
              <div className="notif-meta">{x.read_by}</div>
              <div className="notif-meta">{x.read_at}</div>
            </div>,
            <div key={`actions-${x.id}`} className="action-row">
              <button type="button" className="btn-inline secondary" onClick={() => navigate(x.source_link)}>{t("Open")}</button>
              {x.read ? (
                <span className="chip">{t("Read")}</span>
              ) : (
                <button type="button" className="btn-inline" onClick={() => markOne(x.id)}>{t("Mark Read")}</button>
              )}
            </div>
          ])}
          emptyText={t("No notifications")}
        />
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Notification Preferences")}</h3>
          <div className="grid">
            <div>
              <label>{t("Role")}</label>
              <select value={prefs.role} onChange={(e) => updatePref("role", e.target.value)}>
                <option value="ADMIN">{t("ADMIN")}</option>
                <option value="STAFF">{t("STAFF")}</option>
              </select>
            </div>
            <div className="row row-wrap">
              <div>
                <label>{t("In-App")}</label>
                <select value={prefs.channel_in_app ? "ON" : "OFF"} onChange={(e) => updatePref("channel_in_app", e.target.value === "ON")}>
                  <option value="ON">{t("ON")}</option>
                  <option value="OFF">{t("OFF")}</option>
                </select>
              </div>
              <div>
                <label>{t("Email")}</label>
                <select value={prefs.channel_email ? "ON" : "OFF"} onChange={(e) => updatePref("channel_email", e.target.value === "ON")}>
                  <option value="ON">{t("ON")}</option>
                  <option value="OFF">{t("OFF")}</option>
                </select>
              </div>
            </div>
            <div className="row row-wrap">
              <div>
                <label>{t("Low Stock Threshold")}</label>
                <input type="number" min="0" value={prefs.low_stock_threshold} onChange={(e) => updatePref("low_stock_threshold", Number(e.target.value || 0))} />
              </div>
              <div>
                <label>{t("Expiry Window (days)")}</label>
                <select value={prefs.expiry_window_days} onChange={(e) => updatePref("expiry_window_days", Number(e.target.value))}>
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                </select>
              </div>
            </div>
            <div className="row row-wrap">
              <div>
                <label>{t("Dedup Window (minutes)")}</label>
                <input type="number" min="1" value={prefs.dedup_minutes} onChange={(e) => updatePref("dedup_minutes", Number(e.target.value || 1))} />
              </div>
              <div>
                <label>{t("Suppression")}</label>
                <select value={prefs.suppression_enabled ? "ON" : "OFF"} onChange={(e) => updatePref("suppression_enabled", e.target.value === "ON")}>
                  <option value="ON">{t("ON")}</option>
                  <option value="OFF">{t("OFF")}</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiFetch("/notifications/preferences", {
                    method: "PUT",
                    body: JSON.stringify(prefs)
                  });
                  setMsg(t("Notification preferences saved."));
                } catch (err) {
                  setMsg(`${t("Save preferences failed")}: ${err.message}`);
                }
              }}
            >
              {t("Save Preferences")}
            </button>
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Rule Configuration")}</h3>
        <DataTable
          className="notifications-rules-table"
          columns={[t("Rule"), t("Severity"), t("Channel"), t("Active"), t("Action")]}
          rows={rules.map((r) => [
            t(r.rule),
              t(r.severity),
              t(r.channel),
              r.active ? t("YES") : t("NO"),
              <button key={r.id} type="button" className="btn-inline" onClick={() => toggleRule(r.id)}>{r.active ? t("Disable") : t("Enable")}</button>
            ])}
            emptyText={t("No rules")}
          />
        </article>
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
