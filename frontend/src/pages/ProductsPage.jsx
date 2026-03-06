import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { t } from "../lib/i18n";
import { apiFetch } from "../lib/api";

const initial = [
  { id: 1, product_name: "Coca Cola 330ml", barcode: "8850001", category_name: "Drink", quantity: 14, cost_price: 0.55, selling_price: 0.75, min_stock_level: 10, supplier: "Coca Distributor", expiry_date: "2026-03-30", image_url: "", status: "ACTIVE" },
  { id: 2, product_name: "Instant Noodle", barcode: "8850002", category_name: "Food", quantity: 5, cost_price: 0.3, selling_price: 0.45, min_stock_level: 12, supplier: "Noodle Trading", expiry_date: "2026-08-15", image_url: "", status: "ACTIVE" }
];

function getStockStatus(product) {
  const qty = Number(product.quantity || 0);
  const min = Number(product.min_stock_level || 0);
  if (qty <= 0) return "OUT";
  if (qty <= min) return "LOW";
  return "OK";
}

export default function ProductsPage() {
  const [products, setProducts] = useState(initial);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState("product");
  const [scannerMsg, setScannerMsg] = useState("");
  const [movements, setMovements] = useState([]);
  const [csvInput, setCsvInput] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);

  const [form, setForm] = useState({
    product_name: "",
    barcode: "",
    category_name: "General",
    quantity: 0,
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 0,
    supplier: "",
    expiry_date: "",
    image_url: "",
    status: "ACTIVE"
  });

  const [stockForm, setStockForm] = useState({
    barcode: "",
    adjustment_type: "ADJUSTMENT_IN",
    quantity: 1,
    reason: ""
  });

  const updateForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const updateStockForm = (k, v) => setStockForm((prev) => ({ ...prev, [k]: v }));

  const loadProducts = async () => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("q", search.trim());
    qs.set("supplier", supplierFilter);
    qs.set("stock", stockFilter);
    qs.set("status", statusFilter);
    const res = await apiFetch(`/products?${qs.toString()}`);
    setProducts(Array.isArray(res?.data) ? res.data : []);
  };

  const loadMovements = async () => {
    const res = await apiFetch("/inventory/movements");
    setMovements(Array.isArray(res?.data) ? res.data : []);
  };

  useEffect(() => {
    loadProducts().catch(() => {});
    loadMovements().catch(() => {});
  }, []);

  const suppliers = useMemo(
    () => Array.from(new Set(products.map((p) => p.supplier).filter(Boolean))),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      const qOk = q
        ? p.product_name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category_name.toLowerCase().includes(q)
        : true;
      const supplierOk = supplierFilter === "ALL" ? true : p.supplier === supplierFilter;
      const stockStatus = getStockStatus(p);
      const stockOk = stockFilter === "ALL" ? true : stockStatus === stockFilter;
      const statusOk = statusFilter === "ALL" ? true : p.status === statusFilter;
      return qOk && supplierOk && stockOk && statusOk;
    });

    const keyFn = (p) => {
      if (sortBy === "qty") return Number(p.quantity || 0);
      if (sortBy === "price") return Number(p.selling_price || 0);
      if (sortBy === "supplier") return p.supplier || "";
      if (sortBy === "status") return p.status || "";
      return p.product_name || "";
    };
    list = [...list].sort((a, b) => {
      const va = keyFn(a);
      const vb = keyFn(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return list;
  }, [products, search, supplierFilter, stockFilter, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const activeCount = useMemo(() => products.filter((p) => p.status === "ACTIVE").length, [products]);
  const lowCount = useMemo(() => products.filter((p) => getStockStatus(p) === "LOW").length, [products]);
  const outCount = useMemo(() => products.filter((p) => getStockStatus(p) === "OUT").length, [products]);
  const productStats = useMemo(
    () => [
      { label: t("Total Products"), value: products.length, tone: "" },
      { label: t("Active Products"), value: activeCount, tone: "" },
      { label: t("Low Stock"), value: lowCount, tone: "warning" },
      { label: t("Out of Stock"), value: outCount, tone: "danger" }
    ],
    [products.length, activeCount, lowCount, outCount]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({
      product_name: "",
      barcode: "",
      category_name: "General",
      quantity: 0,
      cost_price: 0,
      selling_price: 0,
      min_stock_level: 0,
      supplier: "",
      expiry_date: "",
      image_url: "",
      status: "ACTIVE"
    });
  };

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes?.length && barcodes[0]?.rawValue) {
        const scanned = String(barcodes[0].rawValue).trim();
        if (scannerTarget === "stock") {
          updateStockForm("barcode", scanned);
        } else {
          updateForm("barcode", scanned);
        }
        setMsg(`${t("Barcode detected")}: ${barcodes[0].rawValue}`);
        setShowScanner(false);
        stopScanner();
        return;
      }
    } catch {
      // continue scanning
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startScanner = async (target = "product") => {
    setScannerTarget(target);
    setScannerMsg("");
    if (!("BarcodeDetector" in window)) {
      setScannerMsg(t("BarcodeDetector is not supported in this browser."));
      return;
    }
    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"]
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;
      setShowScanner(true);
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        rafRef.current = requestAnimationFrame(scanLoop);
      }, 40);
    } catch (error) {
      setScannerMsg(`${t("Unable to start camera scanner")}: ${error.message}`);
      stopScanner();
    }
  };

  const closeScanner = () => {
    setShowScanner(false);
    stopScanner();
  };

  const validateProduct = () => {
    if (!form.product_name || !form.barcode) return t("Product name and barcode are required.");
    if (Number(form.quantity || 0) < 0) return t("Quantity cannot be negative.");
    if (Number(form.cost_price || 0) < 0 || Number(form.selling_price || 0) < 0) return t("Price cannot be negative.");
    const exists = products.find((p) => p.barcode === form.barcode && p.id !== editingId);
    if (exists) return t("Barcode already exists.");
    return "";
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setMsg("");
    const validation = validateProduct();
    if (validation) {
      setMsg(validation);
      return;
    }

    try {
      if (editingId) {
        await apiFetch(`/products/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
        setMsg(t("Product updated."));
      } else {
        await apiFetch("/products", { method: "POST", body: JSON.stringify(form) });
        setMsg(t("Product created."));
      }
      await loadProducts();
      resetForm();
    } catch (err) {
      setMsg(`${t("Save failed")}: ${err.message}`);
    }
  };

  const editProduct = (row) => {
    setEditingId(row.id);
    setForm({ ...row });
  };

  const deleteProduct = async (id) => {
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      await loadProducts();
      setMsg(t("Product deleted."));
    } catch (err) {
      setMsg(`${t("Delete failed")}: ${err.message}`);
    }
  };

  const toggleStatus = async (id) => {
    try {
      const target = products.find((p) => p.id === id);
      if (!target) return;
      await apiFetch(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
      });
      await loadProducts();
      setMsg(t("Product status updated."));
    } catch (err) {
      setMsg(`${t("Status update failed")}: ${err.message}`);
    }
  };

  const submitStock = async (e) => {
    e.preventDefault();
    setMsg("");
    const target = products.find((p) => p.barcode === stockForm.barcode.trim());
    if (!target) {
      setMsg(t("Product not found by barcode."));
      return;
    }

    const qty = Number(stockForm.quantity || 0);
    if (qty < 1) return;

    try {
      await apiFetch("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          barcode: stockForm.barcode.trim(),
          action: stockForm.adjustment_type === "ADJUSTMENT_IN" ? "INCREASE" : "DECREASE",
          quantity: qty,
          reason: stockForm.reason || "UI quick update"
        })
      });
      await loadProducts();
      await loadMovements();
      setMsg(t("Stock updated successfully."));
      setStockForm({ barcode: "", adjustment_type: "ADJUSTMENT_IN", quantity: 1, reason: "" });
      setShowStockModal(false);
    } catch (err) {
      setMsg(`${t("Stock update failed")}: ${err.message}`);
    }
  };

  const handleImageUpload = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateForm("image_url", url);
  };

  const parseCsvRows = (raw) => {
    const rows = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!rows.length) return [];
    return rows
      .map((line) => {
        const [product_name, barcode, category_name, quantity, selling_price, supplier] = line
          .split(",")
          .map((x) => x?.trim() || "");
        return {
          id: Date.now() + Math.floor(Math.random() * 100000),
          product_name,
          barcode,
          category_name: category_name || "General",
          quantity: Number(quantity || 0),
          cost_price: 0,
          selling_price: Number(selling_price || 0),
          min_stock_level: 0,
          supplier: supplier || "",
          expiry_date: "",
          image_url: "",
          status: "ACTIVE"
        };
      })
      .filter((x) => x.product_name && x.barcode);
  };

  const importCsvRows = async () => {
    const mapped = parseCsvRows(csvInput);
    if (!mapped.length) return;
    try {
      const res = await apiFetch("/products/import", { method: "POST", body: JSON.stringify({ rows: mapped }) });
      await loadProducts();
      setCsvInput("");
      setMsg(`${res?.data?.inserted_count ?? 0} ${t("products imported.")}`);
    } catch (err) {
      setMsg(`${t("Import failed")}: ${err.message}`);
    }
  };

  const onCsvFilePicked = async (file) => {
    if (!file) return;
    const text = await file.text();
    setCsvInput(text);
    const mapped = parseCsvRows(text);
    if (!mapped.length) {
      setMsg(t("CSV file has no valid rows."));
      return;
    }
    try {
      const res = await apiFetch("/products/import", { method: "POST", body: JSON.stringify({ rows: mapped }) });
      await loadProducts();
      setMsg(`${res?.data?.inserted_count ?? 0} ${t("products imported from file.")}`);
    } catch (err) {
      setMsg(`${t("CSV import failed")}: ${err.message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Layout title="Products">
      <div className="products-page">
        <section className="hero products-hero">
          <div className="products-hero-head">
            <div>
              <h2>{t("Product Management")}</h2>
              <p>{t("Product list for thesis demo.")}</p>
            </div>
            <button type="button" className="btn-inline secondary products-hero-btn" onClick={() => setShowStockModal(true)}>
              {t("Quick Stock Update")}
            </button>
          </div>
        </section>

        <section className="products-overview">
          {productStats.map((item) => (
            <article key={item.label} className={`products-stat-card ${item.tone ? `is-${item.tone}` : ""}`}>
              <div className="products-stat-label">{item.label}</div>
              <div className="products-stat-value">{item.value}</div>
            </article>
          ))}
        </section>

        <section className="products-workspace">
          <section className="card products-editor-card products-form-card">
            <div className="products-section-top">
              <div>
                <h3 className="card-title">{editingId ? t("Edit Product") : t("Create Product")}</h3>
                <p className="products-section-copy">
                  {editingId ? t("Editing selected product details.") : t("Create a new catalog item with pricing, stock and supplier details.")}
                </p>
              </div>
              {editingId ? <span className="chip">{t("Edit")}</span> : null}
            </div>

            <form className="grid products-form-grid" onSubmit={saveProduct}>
              <div className="row products-form-row">
                <div><label>{t("Product Name")}</label><input value={form.product_name} onChange={(e) => updateForm("product_name", e.target.value)} required /></div>
                <div className="products-barcode-field">
                  <div className="products-field-head">
                    <label>{t("Barcode")}</label>
                    <button type="button" className="btn-inline secondary products-field-btn" onClick={() => startScanner("product")}>{t("Scan Barcode")}</button>
                  </div>
                  <input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} required />
                </div>
              </div>
              <div className="row products-form-row">
                <div><label>{t("Category")}</label><input value={form.category_name} onChange={(e) => updateForm("category_name", e.target.value)} /></div>
                <div><label>{t("Supplier")}</label><input value={form.supplier} onChange={(e) => updateForm("supplier", e.target.value)} /></div>
              </div>
              <div className="row products-form-row">
                <div><label>{t("Qty")}</label><input type="number" min="0" value={form.quantity} onChange={(e) => updateForm("quantity", Number(e.target.value))} /></div>
                <div><label>{t("Min Stock Level")}</label><input type="number" min="0" value={form.min_stock_level} onChange={(e) => updateForm("min_stock_level", Number(e.target.value))} /></div>
              </div>
              <div className="row products-form-row">
                <div><label>{t("Cost Price")}</label><input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => updateForm("cost_price", Number(e.target.value))} /></div>
                <div><label>{t("Selling Price")}</label><input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => updateForm("selling_price", Number(e.target.value))} /></div>
              </div>
              <div className="row products-form-row">
                <div><label>{t("Expiry Date")}</label><input type="date" value={form.expiry_date} onChange={(e) => updateForm("expiry_date", e.target.value)} /></div>
                <div>
                  <label>{t("Status")}</label>
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option value="ACTIVE">{t("ACTIVE")}</option>
                    <option value="INACTIVE">{t("INACTIVE")}</option>
                  </select>
                </div>
              </div>
              <div className="row products-form-row">
                <div>
                  <label>{t("Image URL")}</label>
                  <input value={form.image_url} onChange={(e) => updateForm("image_url", e.target.value)} placeholder={t("https://...")} />
                </div>
                <div className="products-upload-field">
                  <label>{t("Upload Image")}</label>
                  <input className="products-file-input" type="file" accept="image/*" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                </div>
              </div>
              <div className="row products-form-actions">
                <button type="submit">{editingId ? t("Save Changes") : t("Save Product")}</button>
                <button type="button" className="secondary" onClick={resetForm}>{t("Clear")}</button>
              </div>
            </form>
          </section>

          <aside className="products-side-stack">
            <section className="card products-utility-card">
              <div className="products-section-top">
                <div>
                  <h3 className="card-title">{t("Quick Actions")}</h3>
                  <p className="products-section-copy">{t("Open fast stock correction, barcode scanning and inventory checks without leaving this page.")}</p>
                </div>
              </div>
              <div className="products-side-actions">
                <button type="button" onClick={() => setShowStockModal(true)}>{t("Quick Stock Update")}</button>
                <button type="button" className="secondary" onClick={() => startScanner("product")}>{t("Scan Barcode")}</button>
              </div>
              <div className="products-side-meta">
                <div>
                  <span>{t("Visible in List")}</span>
                  <strong>{filtered.length}</strong>
                </div>
                <div>
                  <span>{t("Tracked Suppliers")}</span>
                  <strong>{suppliers.length}</strong>
                </div>
                <div>
                  <span>{t("Movement Entries")}</span>
                  <strong>{movements.length}</strong>
                </div>
              </div>
            </section>

            <section className="card products-import-card">
              <div className="products-section-top">
                <div>
                  <h3 className="card-title">{t("Import Center")}</h3>
                  <p className="products-section-copy">{t("Paste or upload CSV rows to add products in bulk.")}</p>
                </div>
              </div>
              <div className="row mt-12 products-import-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()}>{t("Import CSV File")}</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => onCsvFilePicked(e.target.files?.[0])}
                />
                <button type="button" className="secondary" onClick={importCsvRows}>{t("Import Pasted Lines")}</button>
              </div>
              <textarea
                className="mt-12"
                rows="5"
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder={t("Green Tea,8858899,Drink,25,0.95,Tea Supplier")}
              />
              <div className="row mt-12">
                <button type="button" className="secondary" onClick={() => setCsvInput("")}>{t("Clear")}</button>
              </div>
            </section>
          </aside>
        </section>

        <section className="card products-list-card">
          <div className="card-head page-head-actions products-list-head">
            <div>
              <h3 className="card-title">{t("Product List")}</h3>
              <p className="products-section-copy">{t("Review the catalog with filters, status control and inventory availability.")}</p>
            </div>
            <div className="table-actions">
              <input placeholder={t("Search by name or barcode")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="row mb-14 products-filters">
            <div>
              <label>{t("Supplier")}</label>
              <select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
                <option value="ALL">{t("ALL")}</option>
                {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label>{t("Stock Status")}</label>
              <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}>
                <option value="ALL">{t("ALL")}</option>
                <option value="OK">{t("OK")}</option>
                <option value="LOW">{t("LOW")}</option>
                <option value="OUT">{t("OUT")}</option>
              </select>
            </div>
            <div>
              <label>{t("Product Status")}</label>
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
                <option value="qty">{t("Quantity")}</option>
                <option value="price">{t("Price")}</option>
                <option value="supplier">{t("Supplier")}</option>
                <option value="status">{t("Status")}</option>
              </select>
            </div>
            <div>
              <label>{t("Direction")}</label>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                <option value="asc">{t("ASC")}</option>
                <option value="desc">{t("DESC")}</option>
              </select>
            </div>
          </div>
          <DataTable
            className="products-table"
            columns={[t("Product"), t("Category"), t("Supplier"), t("Stock"), t("Price"), t("Status"), t("Action")]}
            rows={pagedRows.map((x) => [
              <div key={`product-${x.id}`} className="products-product-cell">
                <strong>{x.product_name}</strong>
                <span>{t("ID")} #{x.id}</span>
                <span>{t("Barcode")}: {x.barcode}</span>
              </div>,
              x.category_name,
              <div key={`supplier-${x.id}`} className="products-supplier-cell">
                <strong>{x.supplier || "-"}</strong>
                <span>{x.expiry_date || "-"}</span>
              </div>,
              <div key={`stock-${x.id}`} className="products-stock-cell">
                <span className={`chip ${getStockStatus(x) === "OUT" ? "danger" : getStockStatus(x) === "LOW" ? "warning" : ""}`}>
                  {t(getStockStatus(x))}
                </span>
                <span>{t("Qty")}: {x.quantity}</span>
                <span>{t("Min")}: {x.min_stock_level}</span>
              </div>,
              <div key={`price-${x.id}`} className="products-price-cell">
                <strong>${Number(x.selling_price || 0).toFixed(2)}</strong>
                <span>{t("Cost Price")}: ${Number(x.cost_price || 0).toFixed(2)}</span>
              </div>,
              <div key={`status-${x.id}`} className="products-status-cell">
                <span className={`chip ${x.status === "INACTIVE" ? "danger" : ""}`}>{t(x.status || "ACTIVE")}</span>
                <span>{t("Image")}: {x.image_url ? t("Yes") : t("No")}</span>
              </div>,
              <div key={x.id} className="action-row products-action-cell">
                <div className="products-action-top">
                  <button type="button" className="btn-inline" onClick={() => editProduct(x)}>{t("Edit")}</button>
                  <button type="button" className="btn-inline secondary" onClick={() => toggleStatus(x.id)}>
                    {x.status === "ACTIVE" ? t("Archive") : t("Activate")}
                  </button>
                </div>
                <button type="button" className="btn-inline danger" onClick={() => deleteProduct(x.id)}>{t("Delete")}</button>
              </div>
            ])}
            emptyText="No products"
          />
          <div className="row mt-12 products-pagination">
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

        <section className="card products-ledger-card">
          <div className="products-section-top">
            <div>
              <h3 className="card-title">{t("Stock Movement Ledger")}</h3>
              <p className="products-section-copy">{t("Review the current stock movement log below.")}</p>
            </div>
          </div>
          <DataTable
            columns={[t("Time"), t("Product"), t("Barcode"), t("Type"), t("Qty"), t("Reason")]}
            rows={movements.map((m) => [m.time, m.product_name, m.barcode, m.type, m.quantity, m.reason])}
            emptyText="No stock movement yet"
          />
        </section>
      </div>

      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title={t("Quick Stock Update")}>
        <form className="grid" onSubmit={submitStock}>
          <div>
            <label>{t("Barcode")}</label>
            <div className="inline-input-action">
              <input value={stockForm.barcode} onChange={(e) => updateStockForm("barcode", e.target.value)} required />
              <button type="button" className="btn-inline secondary" onClick={() => startScanner("stock")}>{t("Scan")}</button>
            </div>
          </div>
          <div className="row">
            <div>
              <label>{t("Adjustment Type")}</label>
              <select value={stockForm.adjustment_type} onChange={(e) => updateStockForm("adjustment_type", e.target.value)}>
                <option value="ADJUSTMENT_IN">{t("Increase (+)")}</option>
                <option value="ADJUSTMENT_OUT">{t("Decrease (-)")}</option>
              </select>
            </div>
            <div><label>{t("Qty")}</label><input type="number" min="1" value={stockForm.quantity} onChange={(e) => updateStockForm("quantity", Number(e.target.value))} required /></div>
          </div>
          <div><label>{t("Reason")}</label><input value={stockForm.reason} onChange={(e) => updateStockForm("reason", e.target.value)} placeholder={t("Stock received / Correction")} /></div>
          <button type="submit">{t("Update Stock")}</button>
        </form>
      </Modal>

      <Modal open={showScanner} onClose={closeScanner} title={t("Scan Barcode")}>
        <p className="mb-14">{t("Point your camera at a barcode to fill barcode input.")}</p>
        <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
        {scannerMsg ? <div className="msg error">{scannerMsg}</div> : null}
      </Modal>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
