import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";

const seed = [
  { id: 1, name: "Drink", description: "Beverages and bottled items", status: "ACTIVE" },
  { id: 2, name: "Snack", description: "Packaged snacks", status: "ACTIVE" }
];

export default function CategoriesPage() {
  const [items, setItems] = useState(seed);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
  }, [items, search]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const submit = (e) => {
    e.preventDefault();
    setMsg("");
    if (!name.trim()) return;

    if (editingId) {
      setItems((prev) => prev.map((x) => (x.id === editingId ? { ...x, name: name.trim(), description: description.trim() } : x)));
      setMsg("Category updated.");
    } else {
      setItems((prev) => [
        ...prev,
        { id: Date.now(), name: name.trim(), description: description.trim(), status: "ACTIVE" }
      ]);
      setMsg("Category created.");
    }
    resetForm();
  };

  const editRow = (row) => {
    setEditingId(row.id);
    setName(row.name);
    setDescription(row.description || "");
  };

  const delRow = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setMsg("Category deleted.");
    if (editingId === id) resetForm();
  };

  return (
    <Layout title="Categories">
      <section className="hero">
        <h2>{t("Categories")}</h2>
        <p>{t("Category management module.")}</p>
      </section>

      <section className="card">
        <h3 className="card-title">{editingId ? "Update Category" : "Create Category"}</h3>
        <form className="grid" onSubmit={submit}>
          <div className="row">
            <div>
              <label>{t("Name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button type="submit">{editingId ? "Update" : "Save"}</button>
            <button type="button" className="secondary" onClick={resetForm}>Clear</button>
          </div>
        </form>
        {msg ? <div className="msg ok">{msg}</div> : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Category List</h3>
          <div className="table-actions">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category" />
          </div>
        </div>

        <DataTable
          columns={["ID", "Name", "Description", "Status", "Action"]}
          rows={filtered.map((x) => [
            x.id,
            x.name,
            x.description || "-",
            x.status,
            <div key={x.id} className="action-row">
              <button type="button" className="btn-inline" onClick={() => editRow(x)}>Edit</button>
              <button type="button" className="btn-inline danger ml-6" onClick={() => delRow(x.id)}>Delete</button>
            </div>
          ])}
          emptyText="No categories"
        />
      </section>
    </Layout>
  );
}
