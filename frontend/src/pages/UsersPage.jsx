import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";

const defaultUsers = [
  { id: 1, full_name: "Demo Admin", email: "admin@example.com", role: "ADMIN", status: "ACTIVE" },
  { id: 2, full_name: "Cashier One", email: "staff1@example.com", role: "STAFF", status: "ACTIVE" }
];

const permissionKeys = [
  "dashboard.view",
  "products.view",
  "sales.create",
  "reports.view",
  "ai.view",
  "categories.manage",
  "users.manage",
  "email.manage"
];

export default function UsersPage() {
  const [users, setUsers] = useState(defaultUsers);
  const [form, setForm] = useState({ full_name: "", email: "", role: "STAFF", status: "ACTIVE", password: "" });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [rolePerms, setRolePerms] = useState({
    ADMIN: permissionKeys,
    STAFF: ["dashboard.view", "products.view", "sales.create", "reports.view"]
  });

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const visibleUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const reset = () => {
    setEditingId(null);
    setForm({ full_name: "", email: "", role: "STAFF", status: "ACTIVE", password: "" });
  };

  const saveUser = (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.full_name || !form.email) return;

    if (editingId) {
      setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...form } : u)));
      setMsg("User updated.");
    } else {
      setUsers((prev) => [...prev, { id: Date.now(), ...form }]);
      setMsg("User created.");
    }
    reset();
  };

  const editUser = (u) => {
    setEditingId(u.id);
    setForm({ full_name: u.full_name, email: u.email, role: u.role, status: u.status, password: "" });
  };

  const deleteUser = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setMsg("User deleted.");
  };

  const togglePerm = (role, perm) => {
    setRolePerms((prev) => {
      const has = prev[role].includes(perm);
      return {
        ...prev,
        [role]: has ? prev[role].filter((p) => p !== perm) : [...prev[role], perm]
      };
    });
  };

  return (
    <Layout title="Users">
      <section className="hero">
        <h2>{t("Users")}</h2>
        <p>{t("User and role module.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">{editingId ? "Edit User" : "Create User"}</h3>
        <form className="grid" onSubmit={saveUser}>
          <div className="row">
            <div><label>Full Name</label><input value={form.full_name} onChange={(e) => updateForm("full_name", e.target.value)} required /></div>
            <div><label>{t("Email")}</label><input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required /></div>
          </div>
          <div className="row">
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                <option value="ADMIN">ADMIN</option>
                <option value="STAFF">STAFF</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
          <div>
            <label>Password {editingId ? "(Optional)" : ""}</label>
            <input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} />
          </div>
          <div className="row">
            <button type="submit">{editingId ? "Save Changes" : "Create User"}</button>
            <button type="button" className="secondary" onClick={reset}>Clear</button>
          </div>
        </form>
        {msg ? <div className="msg ok">{msg}</div> : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">User List</h3>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
        </div>

        <DataTable
          columns={["ID", "Name", "Email", "Role", "Status", "Action"]}
          rows={visibleUsers.map((u) => [
            u.id,
            u.full_name,
            u.email,
            u.role,
            u.status,
            <div key={u.id} className="action-row">
              <button type="button" className="btn-inline" onClick={() => editUser(u)}>Edit</button>
              <button type="button" className="btn-inline danger ml-6" onClick={() => deleteUser(u.id)}>Delete</button>
            </div>
          ])}
          emptyText="No users"
        />
      </section>

      <section className="card">
        <h3 className="card-title">Roles & Permissions</h3>
        <div className="grid grid-2">
          {["ADMIN", "STAFF"].map((role) => (
            <div key={role} className="role-card">
              <h4>{role}</h4>
              <div className="permission-grid mt-12">
                {permissionKeys.map((perm) => (
                  <label key={`${role}-${perm}`} className="permission-item">
                    <input
                      type="checkbox"
                      checked={rolePerms[role].includes(perm)}
                      onChange={() => togglePerm(role, perm)}
                    />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
