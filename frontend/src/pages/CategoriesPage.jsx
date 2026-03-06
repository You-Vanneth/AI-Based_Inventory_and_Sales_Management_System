import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { apiFetch } from "../lib/api";
import { t } from "../lib/i18n";

const seed = [
  {
    id: 1,
    name_en: "Drink",
    name_km: "ភេសជ្ជៈ",
    description: "Beverages and bottled items",
    status: "ACTIVE",
    product_count: 24,
    icon_url: "",
    created_by: "Demo Admin",
    created_at: "2026-02-01 09:14",
    updated_by: "Demo Admin",
    updated_at: "2026-03-01 15:02"
  },
  {
    id: 2,
    name_en: "Snack",
    name_km: "អាហារសម្រន់",
    description: "Packaged snacks",
    status: "ACTIVE",
    product_count: 17,
    icon_url: "",
    created_by: "Demo Admin",
    created_at: "2026-02-02 10:44",
    updated_by: "Manager A",
    updated_at: "2026-03-04 11:18"
  }
];

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function CategoriesPage() {
  const fileInputRef = useRef(null);

  const [items, setItems] = useState(seed);
  const [form, setForm] = useState({
    name_en: "",
    name_km: "",
    description: "",
    status: "ACTIVE",
    icon_url: ""
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [editingId, setEditingId] = useState(null);
  const [csvInput, setCsvInput] = useState("");
  const [msg, setMsg] = useState("");

  const loadCategories = async () => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("q", search.trim());
    qs.set("status", statusFilter);
    const res = await apiFetch(`/categories?${qs.toString()}`);
    setItems(Array.isArray(res?.data) ? res.data : []);
  };

  useEffect(() => {
    loadCategories().catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((x) => {
      const qOk = q
        ? x.name_en.toLowerCase().includes(q) ||
          x.name_km.toLowerCase().includes(q) ||
          x.description.toLowerCase().includes(q)
        : true;
      const statusOk = statusFilter === "ALL" ? true : x.status === statusFilter;
      return qOk && statusOk;
    });

    list = [...list].sort((a, b) => {
      const va =
        sortBy === "usage" ? Number(a.product_count || 0) :
        sortBy === "status" ? a.status :
        sortBy === "updated" ? a.updated_at :
        a.name_en;
      const vb =
        sortBy === "usage" ? Number(b.product_count || 0) :
        sortBy === "status" ? b.status :
        sortBy === "updated" ? b.updated_at :
        b.name_en;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return list;
  }, [items, search, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name_en: "", name_km: "", description: "", status: "ACTIVE", icon_url: "" });
  };

  const updateForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const validate = () => {
    if (!form.name_en.trim() || !form.name_km.trim()) return t("Both English and Khmer names are required.");
    const dupe = items.find(
      (x) =>
        x.id !== editingId &&
        (x.name_en.trim().toLowerCase() === form.name_en.trim().toLowerCase() ||
          x.name_km.trim() === form.name_km.trim())
    );
    if (dupe) return t("Category name already exists.");
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    const validation = validate();
    if (validation) {
      setMsg(validation);
      return;
    }
    try {
      if (editingId) {
        await apiFetch(`/categories/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
        setMsg(t("Category updated."));
      } else {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(form) });
        setMsg(t("Category created."));
      }
      await loadCategories();
      resetForm();
    } catch (err) {
      setMsg(`${t("Save failed")}: ${err.message}`);
    }
  };

  const editRow = (row) => {
    setEditingId(row.id);
    setForm({
      name_en: row.name_en,
      name_km: row.name_km,
      description: row.description || "",
      status: row.status || "ACTIVE",
      icon_url: row.icon_url || ""
    });
  };

  const toggleStatus = async (id) => {
    try {
      const target = items.find((x) => x.id === id);
      if (!target) return;
      await apiFetch(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
      });
      await loadCategories();
      setMsg(t("Category status updated."));
    } catch (err) {
      setMsg(`${t("Status update failed")}: ${err.message}`);
    }
  };

  const delRow = async (id) => {
    const target = items.find((x) => x.id === id);
    if (!target) return;
    if (Number(target.product_count || 0) > 0) {
      setMsg(t("Cannot delete category because it is linked to products."));
      return;
    }
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      await loadCategories();
      setMsg(t("Category deleted."));
      if (editingId === id) resetForm();
    } catch (err) {
      setMsg(`${t("Delete failed")}: ${err.message}`);
    }
  };

  const parseCsv = (raw) =>
    raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const [name_en, name_km, description, status] = line.split(",").map((x) => x?.trim() || "");
        return {
          id: Date.now() + Math.floor(Math.random() * 100000),
          name_en,
          name_km,
          description,
          status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          product_count: 0,
          icon_url: "",
          created_by: "CSV Import",
          created_at: new Date().toLocaleString(),
          updated_by: "CSV Import",
          updated_at: new Date().toLocaleString()
        };
      })
      .filter((x) => x.name_en && x.name_km);

  const importPasted = async () => {
    const rows = parseCsv(csvInput);
    if (!rows.length) {
      setMsg(t("No valid category rows."));
      return;
    }
    try {
      let inserted = 0;
      for (const row of rows) {
        try {
          await apiFetch("/categories", { method: "POST", body: JSON.stringify(row) });
          inserted += 1;
        } catch {
          // ignore duplicate
        }
      }
      await loadCategories();
      setCsvInput("");
      setMsg(`${inserted} ${t("categories imported.")}`);
    } catch (err) {
      setMsg(`${t("Import failed")}: ${err.message}`);
    }
  };

  const onFilePicked = async (file) => {
    if (!file) return;
    const raw = await file.text();
    const rows = parseCsv(raw);
    if (!rows.length) {
      setMsg(t("No valid rows in CSV file."));
      return;
    }
    try {
      let inserted = 0;
      for (const row of rows) {
        try {
          await apiFetch("/categories", { method: "POST", body: JSON.stringify(row) });
          inserted += 1;
        } catch {
          // ignore duplicate
        }
      }
      await loadCategories();
      setMsg(`${inserted} ${t("categories imported from file.")}`);
    } catch (err) {
      setMsg(`${t("File import failed")}: ${err.message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportCsv = () => {
    const lines = [
      "name_en,name_km,description,status,product_count,created_by,created_at,updated_by,updated_at",
      ...items.map((x) =>
        [
          csvEscape(x.name_en),
          csvEscape(x.name_km),
          csvEscape(x.description),
          csvEscape(x.status),
          x.product_count,
          csvEscape(x.created_by),
          csvEscape(x.created_at),
          csvEscape(x.updated_by),
          csvEscape(x.updated_at)
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(t("Category export generated."));
  };

  return (
    <Layout title="Categories">
      <section className="hero">
        <h2>{t("Categories")}</h2>
        <p>{t("Category management with multilingual naming, usage tracking, and audit details.")}</p>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Total Categories")}</div><div className="kpi-value">{items.length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Active")}</div><div className="kpi-value">{items.filter((x) => x.status === "ACTIVE").length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Inactive")}</div><div className="kpi-value">{items.filter((x) => x.status === "INACTIVE").length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Linked Products")}</div><div className="kpi-value">{items.reduce((sum, x) => sum + Number(x.product_count || 0), 0)}</div></article>
      </section>

      <section className="card">
        <h3 className="card-title">{editingId ? t("Update Category") : t("Create Category")}</h3>
        <form className="grid" onSubmit={submit}>
          <div className="row">
            <div>
              <label>{t("Name (EN)")}</label>
              <input value={form.name_en} onChange={(e) => updateForm("name_en", e.target.value)} required />
            </div>
            <div>
              <label>{t("Name (KM)")}</label>
              <input value={form.name_km} onChange={(e) => updateForm("name_km", e.target.value)} required />
            </div>
          </div>
          <div className="row">
            <div>
              <label>{t("Description")}</label>
              <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} />
            </div>
            <div>
              <label>{t("Status")}</label>
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                <option value="ACTIVE">{t("ACTIVE")}</option>
                <option value="INACTIVE">{t("INACTIVE")}</option>
              </select>
            </div>
          </div>
          <div>
            <label>{t("Icon/Image URL (Optional)")}</label>
            <input value={form.icon_url} onChange={(e) => updateForm("icon_url", e.target.value)} placeholder={t("https://...")} />
          </div>
          <div className="row">
            <button type="submit">{editingId ? t("Update") : t("Save")}</button>
            <button type="button" className="secondary" onClick={resetForm}>{t("Clear")}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Category List")}</h3>
          <div className="table-actions">
            <button type="button" className="btn-inline secondary" onClick={exportCsv}>{t("Export CSV")}</button>
          </div>
        </div>
        <div className="row row-wrap mb-14">
          <div>
            <label>{t("Search")}</label>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("Search EN/KM/description")} />
          </div>
          <div>
            <label>{t("Status")}</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="ALL">{t("ALL")}</option>
              <option value="ACTIVE">{t("ACTIVE")}</option>
              <option value="INACTIVE">{t("INACTIVE")}</option>
            </select>
          </div>
          <div>
            <label>{t("Sort By")}</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">{t("Name")}</option>
              <option value="usage">{t("Usage")}</option>
              <option value="status">{t("Status")}</option>
              <option value="updated">{t("Updated At")}</option>
            </select>
          </div>
          <div>
            <label>{t("Direction")}</label>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
        </div>

        <DataTable
          wrapCells
          columns={[t("ID"), t("Name EN"), t("Name KM"), t("Description"), t("Status"), t("Usage"), t("Audit"), t("Action")]}
          rows={pageRows.map((x) => [
            x.id,
            x.name_en,
            x.name_km,
            x.description || "-",
            <span key={`st-${x.id}`} className={`chip ${x.status === "INACTIVE" ? "warning" : ""}`}>{t(x.status)}</span>,
            `${x.product_count} ${t("products")}`,
            <div key={`a-${x.id}`} className="notif-audit">
              <div>{t("Created")}: {x.created_by}</div>
              <div className="notif-meta">{x.created_at}</div>
              <div>{t("Updated")}: {x.updated_by}</div>
              <div className="notif-meta">{x.updated_at}</div>
            </div>,
            <div key={`act-${x.id}`} className="action-row">
              <button type="button" className="btn-inline" onClick={() => editRow(x)}>{t("Edit")}</button>
              <button type="button" className="btn-inline secondary" onClick={() => toggleStatus(x.id)}>
                {x.status === "ACTIVE" ? t("Disable") : t("Enable")}
              </button>
              <button type="button" className="btn-inline danger" onClick={() => delRow(x.id)}>{t("Delete")}</button>
            </div>
          ])}
          emptyText={t("No categories")}
        />

        <div className="row row-wrap mt-12">
          <div>
            <label>{t("Page Size")}</label>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          <div>
            <label>{t("Page")}</label>
            <div className="row">
              <button type="button" className="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))}>{t("Prev")}</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t("Next")}</button>
            </div>
            <p className="mt-8">{t("Page")} {page} / {totalPages}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Bulk Import")}</h3>
        <p>{t("Format: `name_en,name_km,description,status`")}</p>
        <div className="row row-wrap mt-12">
          <button type="button" onClick={() => fileInputRef.current?.click()}>{t("Import CSV File")}</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFilePicked(e.target.files?.[0])}
          />
          <button type="button" className="secondary" onClick={importPasted}>{t("Import Pasted Rows")}</button>
        </div>
        <textarea
          className="mt-12"
          rows="4"
          value={csvInput}
          onChange={(e) => setCsvInput(e.target.value)}
          placeholder={"Drink,ភេសជ្ជៈ,Beverages,ACTIVE"}
        />
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
