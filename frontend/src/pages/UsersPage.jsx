import React from "react";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const roleTemplates = {
  ADMINISTRATOR: [
    "dashboard.view",
    "products.manage",
    "sales.manage",
    "reports.view",
    "ai.manage",
    "inventory.manage",
    "categories.manage",
    "users.manage",
    "email.manage"
  ],
  CASHIER: ["dashboard.view", "products.view", "sales.create", "sales.refund", "reports.view"]
};

const permissionKeys = [
  "dashboard.view",
  "products.view",
  "products.manage",
  "sales.create",
  "sales.manage",
  "sales.refund",
  "reports.view",
  "ai.manage",
  "inventory.manage",
  "categories.manage",
  "users.manage",
  "email.manage"
];

const defaultUsers = [
  {
    id: 1,
    username: "admin",
    full_name: "Demo Admin",
    email: "admin@example.com",
    role: "ADMINISTRATOR",
    status: "ACTIVE",
    locked: false,
    force_reset: false,
    created_by: "System",
    created_at: "2026-02-01 08:00",
    updated_by: "System",
    updated_at: "2026-03-01 09:10",
    last_login: "2026-03-05 09:22"
  },
  {
    id: 2,
    username: "cashier1",
    full_name: "Cashier One",
    email: "staff1@example.com",
    role: "CASHIER",
    status: "ACTIVE",
    locked: false,
    force_reset: false,
    created_by: "Demo Admin",
    created_at: "2026-02-03 10:15",
    updated_by: "Manager A",
    updated_at: "2026-03-04 16:05",
    last_login: "2026-03-05 08:44"
  }
];

const defaultSessions = [
  { id: 1, user_id: 1, device: "MacBook Pro", ip: "103.1.2.3", started_at: "2026-03-05 08:10", active: true },
  { id: 2, user_id: 2, device: "Windows POS", ip: "10.0.0.12", started_at: "2026-03-05 07:55", active: true }
];

function passwordStrength(password) {
  const text = String(password || "");
  if (!text) return { label: "-", score: 0 };
  let score = 0;
  if (text.length >= 8) score += 1;
  if (/[A-Z]/.test(text)) score += 1;
  if (/[a-z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  if (score <= 2) return { label: "Weak", score };
  if (score <= 4) return { label: "Medium", score };
  return { label: "Strong", score };
}

export default function UsersPage() {
  const [users, setUsers] = useState(defaultUsers);
  const [sessions, setSessions] = useState(defaultSessions);
  const [activity, setActivity] = useState([]);
  const [quickAction, setQuickAction] = useState({});
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [userPerms, setUserPerms] = useState({});
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    role: "CASHIER",
    status: "ACTIVE",
    password: "",
    force_reset: false
  });

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const loadUsers = async () => {
    const res = await apiFetch(`/users${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
    setUsers(Array.isArray(res?.data) ? res.data : []);
  };
  const loadSessions = async () => {
    const res = await apiFetch("/users/sessions");
    setSessions(Array.isArray(res?.data) ? res.data : []);
  };
  const loadActivity = async () => {
    const res = await apiFetch("/users/activity");
    setActivity(Array.isArray(res?.data) ? res.data : []);
  };
  const loadPermissionsForAll = async (rows) => {
    const map = {};
    await Promise.all(
      rows.map(async (u) => {
        try {
          const res = await apiFetch(`/users/${u.id}/permissions`);
          map[u.id] = Array.isArray(res?.data) ? res.data : [];
        } catch {
          map[u.id] = roleTemplates[u.role] || [];
        }
      })
    );
    setUserPerms(map);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/users");
        const rows = Array.isArray(res?.data) ? res.data : [];
        setUsers(rows);
        await loadPermissionsForAll(rows);
      } catch {
        // keep seed fallback
      }
      loadSessions().catch(() => {});
      loadActivity().catch(() => {});
    })();
  }, []);

  const logAction = (action, detail) => {
    setActivity((prev) => [{ id: Date.now(), time: new Date().toLocaleString(), action, detail }, ...prev]);
  };

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const visibleUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  const reset = () => {
    setEditingId(null);
    setForm({
      username: "",
      full_name: "",
      email: "",
      role: "CASHIER",
      status: "ACTIVE",
      password: "",
      force_reset: false
    });
  };

  const validate = () => {
    if (!form.username || !form.full_name || !form.email) return t("Username, full name, and email are required.");
    const emailExists = users.find((u) => u.id !== editingId && u.email.toLowerCase() === form.email.toLowerCase());
    if (emailExists) return t("Email already exists.");
    const usernameExists = users.find((u) => u.id !== editingId && u.username.toLowerCase() === form.username.toLowerCase());
    if (usernameExists) return t("Username already exists.");
    if (!editingId || form.password) {
      if (String(form.password).length < 8) return t("Password must be at least 8 characters.");
      if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
        return t("Password must include uppercase, lowercase, and number.");
      }
    }
    return "";
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setMsg("");
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }

    try {
      if (editingId) {
        await apiFetch(`/users/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            username: form.username,
            full_name: form.full_name,
            email: form.email,
            role: form.role,
            status: form.status,
            force_reset: form.force_reset
          })
        });
        setMsg(t("User updated."));
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({
            username: form.username,
            full_name: form.full_name,
            email: form.email,
            role: form.role,
            status: form.status,
            password: form.password,
            force_reset: form.force_reset
          })
        });
        setMsg(t("User created."));
      }
      await loadUsers();
      await loadSessions();
      await loadActivity();
      reset();
    } catch (err2) {
      setMsg(`${t("Save failed")}: ${err2.message}`);
    }
  };

  const editUser = (u) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      status: u.status,
      password: "",
      force_reset: u.force_reset || false
    });
  };

  const deleteUser = async (id) => {
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      await loadUsers();
      await loadActivity();
      setMsg(t("User deleted."));
    } catch (err) {
      setMsg(`${t("Delete failed")}: ${err.message}`);
    }
  };

  const toggleLock = async (id) => {
    try {
      await apiFetch(`/users/${id}/lock-toggle`, { method: "PATCH" });
      await loadUsers();
      await loadActivity();
      setMsg(t("User lock status updated."));
    } catch (err) {
      setMsg(`${t("Lock update failed")}: ${err.message}`);
    }
  };

  const forcePasswordReset = async (id) => {
    try {
      await apiFetch(`/users/${id}/force-reset`, { method: "PATCH" });
      await loadUsers();
      await loadActivity();
      setMsg(t("Password reset required for user."));
    } catch (err) {
      setMsg(`${t("Force reset failed")}: ${err.message}`);
    }
  };

  const revokeSessions = async (id) => {
    try {
      await apiFetch(`/users/${id}/sessions/revoke`, { method: "POST" });
      await loadSessions();
      await loadActivity();
      setMsg(t("All sessions revoked for user."));
    } catch (err) {
      setMsg(`${t("Revoke sessions failed")}: ${err.message}`);
    }
  };

  const logoutAllDevices = async (id) => {
    try {
      await apiFetch(`/users/${id}/logout-all`, { method: "POST" });
      await loadSessions();
      await loadActivity();
      setMsg(t("User logged out from all devices."));
    } catch (err) {
      setMsg(`${t("Logout-all failed")}: ${err.message}`);
    }
  };

  const runQuickAction = (user) => {
    const action = quickAction[user.id] || "";
    if (!action) {
      setMsg(t("Select an action first."));
      return;
    }
    if (action === "TOGGLE_LOCK") toggleLock(user.id);
    if (action === "FORCE_RESET") forcePasswordReset(user.id);
    if (action === "REVOKE_SESSIONS") revokeSessions(user.id);
    if (action === "LOGOUT_ALL") logoutAllDevices(user.id);
    setQuickAction((prev) => ({ ...prev, [user.id]: "" }));
  };

  const applyRoleTemplate = async (role) => {
    if (!editingId) {
      setMsg(t("Select a user first by clicking Edit."));
      return;
    }
    const next = [...(roleTemplates[role] || [])];
    try {
      await apiFetch(`/users/${editingId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: next })
      });
      setUserPerms((prev) => ({ ...prev, [editingId]: next }));
      await loadActivity();
      setMsg(`${t(role)} ${t("permissions applied.")}`);
    } catch (err) {
      setMsg(`${t("Apply role template failed")}: ${err.message}`);
    }
  };

  const effectivePerms = (userId, role) => userPerms[userId] || roleTemplates[role] || [];

  const togglePermForUser = async (userId, role, perm) => {
    const current = userPerms[userId] || [...(roleTemplates[role] || [])];
    const has = current.includes(perm);
    const next = has ? current.filter((p) => p !== perm) : [...current, perm];
    try {
      await apiFetch(`/users/${userId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: next })
      });
      setUserPerms((prev) => ({ ...prev, [userId]: next }));
    } catch (err) {
      setMsg(`${t("Permission update failed")}: ${err.message}`);
    }
  };

  return (
    <Layout title="Users">
      <section className="hero">
        <h2>{t("Users")}</h2>
        <p>{t("User, role, security, and audit management module.")}</p>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Total Users")}</div><div className="kpi-value">{users.length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Active")}</div><div className="kpi-value">{users.filter((u) => u.status === "ACTIVE").length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Locked")}</div><div className="kpi-value">{users.filter((u) => u.locked).length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Active Sessions")}</div><div className="kpi-value">{sessions.filter((s) => s.active).length}</div></article>
      </section>

      <section className="card">
        <h3 className="card-title">{editingId ? t("Edit User") : t("Create User")}</h3>
        <form className="grid" onSubmit={saveUser}>
          <div className="row row-wrap">
            <div><label>{t("Username")}</label><input value={form.username} onChange={(e) => updateForm("username", e.target.value)} required /></div>
            <div><label>{t("Full Name")}</label><input value={form.full_name} onChange={(e) => updateForm("full_name", e.target.value)} required /></div>
            <div><label>{t("Email")}</label><input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required /></div>
          </div>
          <div className="row row-wrap">
            <div>
              <label>{t("Role Template")}</label>
              <select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                <option value="ADMINISTRATOR">{t("ADMINISTRATOR")}</option>
                <option value="CASHIER">{t("CASHIER")}</option>
              </select>
            </div>
            <div>
              <label>{t("Status")}</label>
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                <option value="ACTIVE">{t("ACTIVE")}</option>
                <option value="INACTIVE">{t("INACTIVE")}</option>
              </select>
            </div>
            <div>
              <label>{t("Force Password Reset")}</label>
              <select value={form.force_reset ? "YES" : "NO"} onChange={(e) => updateForm("force_reset", e.target.value === "YES")}>
                <option value="NO">{t("NO")}</option>
                <option value="YES">{t("YES")}</option>
              </select>
            </div>
          </div>
          <div>
            <label>{t("Password")} {editingId ? t("(Optional)") : ""}</label>
            <input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} />
            <p className="mt-8">{t("Strength")}: {t(strength.label)}</p>
          </div>
          <div className="row row-wrap">
            <button type="submit">{editingId ? t("Save Changes") : t("Create User")}</button>
            <button type="button" className="secondary" onClick={reset}>{t("Clear")}</button>
            <button type="button" className="secondary" onClick={() => applyRoleTemplate(form.role)}>{t("Apply Role Template")}</button>
          </div>
        </form>
        {msg ? <div className="msg ok">{msg}</div> : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("User List")}</h3>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search username/name/email")} />
        </div>
        <DataTable
          className="users-table"
          columns={[t("ID"), t("User"), t("Role"), t("Status"), t("Security"), t("Audit"), t("Action")]}
          rows={visibleUsers.map((u) => [
            u.id,
            <div key={`u-${u.id}`} className="notif-audit">
              <div><strong>{u.username}</strong> ({u.full_name})</div>
              <div className="notif-meta">{u.email}</div>
              <div className="notif-meta">{t("Last login")}: {u.last_login}</div>
            </div>,
            <span key={`r-${u.id}`} className="chip">{t(u.role)}</span>,
            <span key={`s-${u.id}`} className={`chip ${u.status === "INACTIVE" ? "warning" : ""}`}>{t(u.status)}</span>,
            <div key={`sec-${u.id}`} className="notif-audit">
              <div>{u.locked ? t("LOCKED") : t("UNLOCKED")}</div>
              <div>{u.force_reset ? `${t("FORCE_RESET")}: ${t("YES")}` : `${t("FORCE_RESET")}: ${t("NO")}`}</div>
            </div>,
            <div key={`a-${u.id}`} className="notif-audit">
              <div>{t("Created")}: {u.created_by}</div>
              <div className="notif-meta">{u.created_at}</div>
              <div>{t("Updated")}: {u.updated_by}</div>
              <div className="notif-meta">{u.updated_at}</div>
            </div>,
            <div key={u.id} className="users-action-cell">
              <div className="users-action-top">
                <button type="button" className="btn-inline" onClick={() => editUser(u)}>{t("Edit")}</button>
                <button type="button" className="btn-inline danger" onClick={() => deleteUser(u.id)}>{t("Delete")}</button>
              </div>
              <div className="users-action-bottom">
                <select
                  className="min-select"
                  value={quickAction[u.id] || ""}
                  onChange={(e) => setQuickAction((prev) => ({ ...prev, [u.id]: e.target.value }))}
                >
                  <option value="">{t("Action...")}</option>
                  <option value="TOGGLE_LOCK">{u.locked ? t("Unlock") : t("Lock")}</option>
                  <option value="FORCE_RESET">{t("Force Reset")}</option>
                  <option value="REVOKE_SESSIONS">{t("Revoke Sessions")}</option>
                  <option value="LOGOUT_ALL">{t("Logout All Devices")}</option>
                </select>
                <button type="button" className="btn-inline secondary" onClick={() => runQuickAction(u)}>{t("Apply")}</button>
              </div>
            </div>
          ])}
          emptyText={t("No users")}
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Per-User Permissions")}</h3>
        <div className="grid grid-2">
          {visibleUsers.map((u) => (
            <div key={`perm-${u.id}`} className="role-card">
              <h4>{u.username} ({t(u.role)})</h4>
              <div className="permission-grid mt-12">
                {permissionKeys.map((perm) => (
                  <label key={`${u.id}-${perm}`} className="permission-item">
                    <input
                      type="checkbox"
                      checked={effectivePerms(u.id, u.role).includes(perm)}
                      onChange={() => togglePermForUser(u.id, u.role, perm)}
                    />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Session Management")}</h3>
          <DataTable
            columns={[t("User ID"), t("Device"), t("IP"), t("Started At"), t("Status")]}
            rows={sessions.map((s) => [s.user_id, s.device, s.ip, s.started_at, s.active ? t("ACTIVE") : t("REVOKED")])}
            emptyText={t("No sessions")}
          />
        </article>

        <article className="card">
          <h3 className="card-title">{t("Activity Log")}</h3>
          <DataTable
            columns={[t("Time"), t("Action"), t("Detail")]}
            rows={activity.map((a) => [a.time, a.action, a.detail])}
            emptyText={t("No activity yet")}
          />
        </article>
      </section>
    </Layout>
  );
}
