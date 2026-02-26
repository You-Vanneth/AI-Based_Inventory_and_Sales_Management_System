import React from "react";
import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { t } from "../lib/i18n";

const initial = [
  { id: 1, product_name: "Coca Cola 330ml", barcode: "8850001", category_name: "Drink", quantity: 14, cost_price: 0.55, selling_price: 0.75, min_stock_level: 10, supplier: "Coca Distributor", expiry_date: "2026-03-30" },
  { id: 2, product_name: "Instant Noodle", barcode: "8850002", category_name: "Food", quantity: 5, cost_price: 0.3, selling_price: 0.45, min_stock_level: 12, supplier: "Noodle Trading", expiry_date: "2026-08-15" }
];

export default function ProductsPage() {
  const [products, setProducts] = useState(initial);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [movements, setMovements] = useState([]);

  const [form, setForm] = useState({
    product_name: "",
    barcode: "",
    category_name: "General",
    quantity: 0,
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 0,
    supplier: "",
    expiry_date: ""
  });

  const [stockForm, setStockForm] = useState({
    barcode: "",
    adjustment_type: "ADJUSTMENT_IN",
    quantity: 1,
    reason: ""
  });

  const updateForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const updateStockForm = (k, v) => setStockForm((prev) => ({ ...prev, [k]: v }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.product_name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q)
    );
  }, [products, search]);

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
      expiry_date: ""
    });
  };

  const saveProduct = (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.product_name || !form.barcode) return;

    if (editingId) {
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...form } : p)));
      setMsg("Product updated.");
    } else {
      setProducts((prev) => [...prev, { id: Date.now(), ...form }]);
      setMsg("Product created.");
    }
    resetForm();
  };

  const editProduct = (row) => {
    setEditingId(row.id);
    setForm({ ...row });
  };

  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setMsg("Product deleted.");
  };

  const submitStock = (e) => {
    e.preventDefault();
    setMsg("");
    const target = products.find((p) => p.barcode === stockForm.barcode.trim());
    if (!target) {
      setMsg("Product not found by barcode.");
      return;
    }

    const qty = Number(stockForm.quantity || 0);
    if (qty < 1) return;

    setProducts((prev) => prev.map((p) => {
      if (p.id !== target.id) return p;
      const nextQty = stockForm.adjustment_type === "ADJUSTMENT_IN" ? p.quantity + qty : Math.max(0, p.quantity - qty);
      return { ...p, quantity: nextQty };
    }));

    setMovements((prev) => [
      {
        id: Date.now(),
        time: new Date().toLocaleString(),
        product_name: target.product_name,
        barcode: target.barcode,
        type: stockForm.adjustment_type,
        quantity: qty,
        reason: stockForm.reason || "-"
      },
      ...prev
    ]);

    setMsg("Stock updated successfully.");
    setStockForm({ barcode: "", adjustment_type: "ADJUSTMENT_IN", quantity: 1, reason: "" });
    setShowStockModal(false);
  };

  return (
    <Layout title="Products">
      <section className="hero">
        <h2>{t("Product Management")}</h2>
        <p>{t("Product list for thesis demo.")}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{editingId ? "Edit Product" : "Create Product"}</h3>
          <button className="btn-inline secondary" onClick={() => setShowStockModal(true)}>Quick Stock Update</button>
        </div>

        <form className="grid" onSubmit={saveProduct}>
          <div className="row">
            <div><label>Product Name</label><input value={form.product_name} onChange={(e) => updateForm("product_name", e.target.value)} required /></div>
            <div><label>{t("Barcode")}</label><input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} required /></div>
          </div>
          <div className="row">
            <div><label>{t("Category")}</label><input value={form.category_name} onChange={(e) => updateForm("category_name", e.target.value)} /></div>
            <div><label>{t("Qty")}</label><input type="number" min="0" value={form.quantity} onChange={(e) => updateForm("quantity", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>Cost Price</label><input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => updateForm("cost_price", Number(e.target.value))} /></div>
            <div><label>Selling Price</label><input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => updateForm("selling_price", Number(e.target.value))} /></div>
          </div>
          <div className="row">
            <div><label>Min Stock Level</label><input type="number" min="0" value={form.min_stock_level} onChange={(e) => updateForm("min_stock_level", Number(e.target.value))} /></div>
            <div><label>Supplier</label><input value={form.supplier} onChange={(e) => updateForm("supplier", e.target.value)} /></div>
          </div>
          <div><label>Expiry Date</label><input type="date" value={form.expiry_date} onChange={(e) => updateForm("expiry_date", e.target.value)} /></div>
          <div className="row">
            <button type="submit">{editingId ? "Save Changes" : "Save Product"}</button>
            <button type="button" className="secondary" onClick={resetForm}>Clear</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{t("Product List")}</h3>
          <input placeholder="Search by name or barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <DataTable
          columns={["ID", "Name", "Barcode", "Category", "Qty", "Price", "Action"]}
          rows={filtered.map((x) => [
            x.id,
            x.product_name,
            x.barcode,
            x.category_name,
            x.quantity,
            `$${Number(x.selling_price || 0).toFixed(2)}`,
            <div key={x.id} className="action-row">
              <button type="button" className="btn-inline" onClick={() => editProduct(x)}>Edit</button>
              <button type="button" className="btn-inline danger ml-6" onClick={() => deleteProduct(x.id)}>Delete</button>
            </div>
          ])}
          emptyText="No products"
        />
      </section>

      <section className="card">
        <h3 className="card-title">Stock Movement Ledger</h3>
        <DataTable
          columns={["Time", "Product", "Barcode", "Type", "Qty", "Reason"]}
          rows={movements.map((m) => [m.time, m.product_name, m.barcode, m.type, m.quantity, m.reason])}
          emptyText="No stock movement yet"
        />
      </section>

      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title="Quick Stock Update">
        <form className="grid" onSubmit={submitStock}>
          <div><label>{t("Barcode")}</label><input value={stockForm.barcode} onChange={(e) => updateStockForm("barcode", e.target.value)} required /></div>
          <div className="row">
            <div>
              <label>Adjustment Type</label>
              <select value={stockForm.adjustment_type} onChange={(e) => updateStockForm("adjustment_type", e.target.value)}>
                <option value="ADJUSTMENT_IN">Increase (+)</option>
                <option value="ADJUSTMENT_OUT">Decrease (-)</option>
              </select>
            </div>
            <div><label>{t("Qty")}</label><input type="number" min="1" value={stockForm.quantity} onChange={(e) => updateStockForm("quantity", Number(e.target.value))} required /></div>
          </div>
          <div><label>Reason</label><input value={stockForm.reason} onChange={(e) => updateStockForm("reason", e.target.value)} placeholder="Stock received / Correction" /></div>
          <button type="submit">Update Stock</button>
        </form>
      </Modal>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
