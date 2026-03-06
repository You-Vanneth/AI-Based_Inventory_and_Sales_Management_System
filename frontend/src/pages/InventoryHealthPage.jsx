import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { t } from "../lib/i18n";
import { apiFetch } from "../lib/api";

const initialStock = [
  { product: "Instant Noodle", barcode: "8850002", category: "Food", qty: 5, min: 12, supplier: "Noodle Trading", monthly_sales: 96, unit_cost: 0.3, status: "ACTIVE", store: "MAIN" },
  { product: "Hand Soap", barcode: "8850011", category: "Personal Care", qty: 2, min: 8, supplier: "Clean Plus", monthly_sales: 18, unit_cost: 0.9, status: "ACTIVE", store: "MAIN" },
  { product: "UHT Milk", barcode: "8850003", category: "Dairy", qty: 8, min: 10, supplier: "Dairy KH", monthly_sales: 41, unit_cost: 0.95, status: "ACTIVE", store: "MAIN" }
];

const initialLots = [
  { product: "UHT Milk", barcode: "8850003", lot: "MILK-A12", qty: 4, expiry: "2026-03-10", supplier: "Dairy KH", store: "MAIN" },
  { product: "UHT Milk", barcode: "8850003", lot: "MILK-B07", qty: 4, expiry: "2026-03-18", supplier: "Dairy KH", store: "MAIN" },
  { product: "Instant Noodle", barcode: "8850002", lot: "NDL-C33", qty: 5, expiry: "2026-08-15", supplier: "Noodle Trading", store: "MAIN" }
];

export default function InventoryHealthPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [store, setStore] = useState("MAIN");
  const [stockRows, setStockRows] = useState(initialStock);
  const [batchLots, setBatchLots] = useState(initialLots);
  const [windowDays, setWindowDays] = useState(30);
  const [movementLog, setMovementLog] = useState([]);
  const [msg, setMsg] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [alertTriggerOnAction, setAlertTriggerOnAction] = useState(true);
  const [alertLog, setAlertLog] = useState([]);

  const [receiveForm, setReceiveForm] = useState({
    barcode: "",
    supplier: "Noodle Trading",
    quantity: 1,
    unit_cost: 0,
    batch_no: "",
    expiry_date: "",
    document_no: ""
  });
  const [adjustForm, setAdjustForm] = useState({
    barcode: "",
    action: "DECREASE",
    quantity: 1,
    reason: "DAMAGED",
    approved_by: "Supervisor A",
    note: ""
  });

  const expiryRows = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + Number(windowDays));
    return batchLots
      .filter((x) => x.store === store)
      .map((x) => {
        const exp = new Date(x.expiry);
        const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...x, days_left: diff };
      })
      .filter((x) => x.days_left <= Number(windowDays))
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  }, [batchLots, store, windowDays]);

  const stockLowRows = useMemo(
    () => stockRows.filter((x) => x.store === store && x.qty < x.min),
    [stockRows, store]
  );

  const outOfStock = useMemo(
    () => stockRows.filter((x) => x.store === store && x.qty <= 0).length,
    [stockRows, store]
  );

  const inventoryTurnover = useMemo(() => {
    const rows = stockRows.filter((x) => x.store === store);
    const cogs = rows.reduce((sum, x) => sum + Number(x.monthly_sales || 0) * Number(x.unit_cost || 0), 0);
    const avgInventory = rows.reduce((sum, x) => sum + Number(x.qty || 0) * Number(x.unit_cost || 0), 0) || 1;
    return Number((cogs / avgInventory).toFixed(2));
  }, [stockRows, store]);

  const deadStock = useMemo(
    () => stockRows.filter((x) => x.store === store && Number(x.monthly_sales || 0) <= 2).length,
    [stockRows, store]
  );

  const statusDist = useMemo(() => {
    const rows = stockRows.filter((x) => x.store === store);
    const dist = { adequate: 0, low: 0, critical: 0, out: 0 };
    rows.forEach((r) => {
      if (r.qty <= 0) dist.out += 1;
      else if (r.qty <= Math.ceil(r.min * 0.5)) dist.critical += 1;
      else if (r.qty < r.min) dist.low += 1;
      else dist.adequate += 1;
    });
    return dist;
  }, [stockRows, store]);

  const updateReceive = (k, v) => setReceiveForm((prev) => ({ ...prev, [k]: v }));
  const updateAdjust = (k, v) => setAdjustForm((prev) => ({ ...prev, [k]: v }));

  const loadInventory = async () => {
    const [prodRes, lotRes, movRes] = await Promise.all([
      apiFetch("/products"),
      apiFetch(`/inventory/lots?store=${encodeURIComponent(store)}`),
      apiFetch("/inventory/movements")
    ]);
    const products = Array.isArray(prodRes?.data) ? prodRes.data : [];
    setStockRows(
      products
        .filter((p) => (p.store || "MAIN") === store)
        .map((p) => ({
          product: p.product_name,
          barcode: p.barcode,
          category: p.category_name || "General",
          qty: Number(p.quantity || 0),
          min: Number(p.min_stock_level || 0),
          supplier: p.supplier || "-",
          monthly_sales: Number(p.monthly_sales || 0),
          unit_cost: Number(p.cost_price || 0),
          status: p.status || "ACTIVE",
          store: p.store || "MAIN"
        }))
    );
    const lots = Array.isArray(lotRes?.data) ? lotRes.data : [];
    setBatchLots(
      lots.map((x) => ({
        product: x.product_name,
        barcode: x.barcode,
        lot: x.lot,
        qty: Number(x.qty || 0),
        expiry: x.expiry,
        supplier: x.supplier || "-",
        store: x.store || "MAIN"
      }))
    );
    const moves = Array.isArray(movRes?.data) ? movRes.data : [];
    setMovementLog(
      moves.map((m) => ({
        id: m.id,
        time: m.time,
        store: m.store,
        product: m.product_name,
        barcode: m.barcode,
        type: m.type,
        qty: Number(m.qty || 0),
        reason: m.reason,
        approved_by: m.approved_by
      }))
    );
  };

  useEffect(() => {
    loadInventory().catch(() => {});
  }, [store]);

  const pushMovement = (row) => {
    setMovementLog((prev) => [{ id: Date.now(), time: new Date().toLocaleString(), store, ...row }, ...prev]);
  };

  const maybeTriggerAlert = (name, details) => {
    if (!alertTriggerOnAction) return;
    setAlertLog((prev) => [
      { id: Date.now(), time: new Date().toLocaleString(), type: name, details, store },
      ...prev
    ]);
  };

  const submitReceiving = async (e) => {
    e.preventDefault();
    setMsg("");
    const qty = Number(receiveForm.quantity || 0);
    if (qty < 1) return;
    const target = stockRows.find((x) => x.barcode === receiveForm.barcode.trim() && x.store === store);
    if (!target) {
      setMsg(t("Barcode not found in current store."));
      return;
    }

    try {
      await apiFetch("/inventory/receive", {
        method: "POST",
        body: JSON.stringify({
          barcode: receiveForm.barcode.trim(),
          quantity: qty,
          reason: `Doc ${receiveForm.document_no || "-"} | Batch ${receiveForm.batch_no || "-"}`,
          batch_no: receiveForm.batch_no,
          expiry_date: receiveForm.expiry_date,
          supplier: receiveForm.supplier
        })
      });
      await loadInventory();
      maybeTriggerAlert("RECEIVING_RECORDED", `${target.product} +${qty}`);
    } catch (err) {
      setMsg(`${t("Receiving failed")}: ${err.message}`);
      return;
    }

    setReceiveForm({
      barcode: "",
      supplier: "Noodle Trading",
      quantity: 1,
      unit_cost: 0,
      batch_no: "",
      expiry_date: "",
      document_no: ""
    });
    setMsg(t("Stock receiving recorded."));
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    setMsg("");
    const qty = Number(adjustForm.quantity || 0);
    if (qty < 1) return;
    const target = stockRows.find((x) => x.barcode === adjustForm.barcode.trim() && x.store === store);
    if (!target) {
      setMsg(t("Barcode not found in current store."));
      return;
    }

    try {
      await apiFetch("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          barcode: adjustForm.barcode.trim(),
          action: adjustForm.action,
          quantity: qty,
          reason: `${adjustForm.reason}${adjustForm.note ? ` | ${adjustForm.note}` : ""}`,
          approved_by: adjustForm.approved_by
        })
      });
      await loadInventory();
      maybeTriggerAlert("STOCK_ADJUSTED", `${target.product} ${adjustForm.action} ${qty}`);
    } catch (err) {
      setMsg(`${t("Adjustment failed")}: ${err.message}`);
      return;
    }

    setAdjustForm({
      barcode: "",
      action: "DECREASE",
      quantity: 1,
      reason: "DAMAGED",
      approved_by: "Supervisor A",
      note: ""
    });
    setMsg(t("Stock adjustment recorded."));
  };

  const parseBulkAdjust = (raw) => {
    return raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const [barcode, action, quantity, reason, approved_by] = line.split(",").map((x) => x?.trim() || "");
        return {
          barcode,
          action: action || "DECREASE",
          quantity: Number(quantity || 0),
          reason: reason || "BULK",
          approved_by: approved_by || "Bulk Supervisor"
        };
      })
      .filter((x) => x.barcode && x.quantity > 0);
  };

  const applyBulkAdjust = async (rows) => {
    try {
      const res = await apiFetch("/inventory/adjust/bulk", {
        method: "POST",
        body: JSON.stringify({ rows })
      });
      await loadInventory();
      rows.forEach((r) => maybeTriggerAlert("BULK_ADJUSTMENT", `${r.barcode} ${r.action} ${r.quantity}`));
      setMsg(`${t("Bulk adjustment applied to")} ${res?.data?.applied ?? 0} ${t("product(s).")}`);
    } catch (err) {
      setMsg(`${t("Bulk adjustment failed")}: ${err.message}`);
    }
  };

  const importBulkText = () => {
    const rows = parseBulkAdjust(csvInput);
    if (!rows.length) {
      setMsg(t("No valid bulk rows."));
      return;
    }
    applyBulkAdjust(rows);
    setCsvInput("");
  };

  const onBulkFilePicked = async (file) => {
    if (!file) return;
    const raw = await file.text();
    setCsvInput(raw);
    const rows = parseBulkAdjust(raw);
    if (!rows.length) {
      setMsg(t("No valid CSV adjustment rows."));
      return;
    }
    applyBulkAdjust(rows);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Layout title="Inventory Health">
      <section className="hero">
        <h2>{t("Inventory Health Center")}</h2>
        <p>{t("low stock and expiry priorities.")}</p>
        <div className="row mt-12">
          <div>
            <label>{t("Store")}</label>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="MAIN">{t("MAIN")}</option>
              <option value="BRANCH_A">{t("BRANCH_A")}</option>
            </select>
          </div>
          <div>
            <label>{t("Window (Days)")}</label>
            <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </div>
          <div>
            <label>{t("Alert Trigger on Action")}</label>
            <select value={alertTriggerOnAction ? "YES" : "NO"} onChange={(e) => setAlertTriggerOnAction(e.target.value === "YES")}>
              <option value="YES">{t("YES")}</option>
              <option value="NO">{t("NO")}</option>
            </select>
          </div>
          <div>
            <label>{t("Action")}</label>
            <button type="button" onClick={() => setMsg(t("Inventory dashboard refreshed."))}>{t("Refresh")}</button>
          </div>
        </div>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Low Stock Items")}</div><div className="kpi-value">{stockLowRows.length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Expiring Soon")}</div><div className="kpi-value">{expiryRows.length}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Inventory Turnover")}</div><div className="kpi-value">{inventoryTurnover}x</div></article>
        <article className="kpi"><div className="kpi-label">{t("Dead Stock")}</div><div className="kpi-value">{deadStock}</div></article>
      </section>

      <section className="grid grid-4">
        <article className="kpi"><div className="kpi-label">{t("Adequate")}</div><div className="kpi-value">{statusDist.adequate}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Low")}</div><div className="kpi-value">{statusDist.low}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Critical")}</div><div className="kpi-value">{statusDist.critical}</div></article>
        <article className="kpi"><div className="kpi-label">{t("Out")}</div><div className="kpi-value">{outOfStock}</div></article>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Supplier-Linked Stock Receiving")}</h3>
          <form className="grid" onSubmit={submitReceiving}>
            <div className="row">
              <div><label>{t("Barcode")}</label><input value={receiveForm.barcode} onChange={(e) => updateReceive("barcode", e.target.value)} required /></div>
              <div><label>{t("Supplier")}</label>
                <select value={receiveForm.supplier} onChange={(e) => updateReceive("supplier", e.target.value)}>
                  <option value="Noodle Trading">Noodle Trading</option>
                  <option value="Dairy KH">Dairy KH</option>
                  <option value="Clean Plus">Clean Plus</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div><label>{t("Qty")}</label><input type="number" min="1" value={receiveForm.quantity} onChange={(e) => updateReceive("quantity", Number(e.target.value))} required /></div>
              <div><label>{t("Unit Cost")}</label><input type="number" step="0.01" min="0" value={receiveForm.unit_cost} onChange={(e) => updateReceive("unit_cost", Number(e.target.value))} /></div>
            </div>
            <div className="row">
              <div><label>{t("Batch No.")}</label><input value={receiveForm.batch_no} onChange={(e) => updateReceive("batch_no", e.target.value)} /></div>
              <div><label>{t("Expiry Date")}</label><input type="date" value={receiveForm.expiry_date} onChange={(e) => updateReceive("expiry_date", e.target.value)} /></div>
            </div>
            <div><label>{t("Reference Document No.")}</label><input value={receiveForm.document_no} onChange={(e) => updateReceive("document_no", e.target.value)} placeholder={t("GRN-2026-0012")} /></div>
            <button type="submit">{t("Record Receiving")}</button>
          </form>
        </article>

        <article className="card">
          <h3 className="card-title">{t("Adjustment with Approval")}</h3>
          <form className="grid" onSubmit={submitAdjustment}>
            <div className="row">
              <div><label>{t("Barcode")}</label><input value={adjustForm.barcode} onChange={(e) => updateAdjust("barcode", e.target.value)} required /></div>
              <div><label>{t("Qty")}</label><input type="number" min="1" value={adjustForm.quantity} onChange={(e) => updateAdjust("quantity", Number(e.target.value))} required /></div>
            </div>
            <div className="row">
              <div>
                <label>{t("Adjustment Type")}</label>
                <select value={adjustForm.action} onChange={(e) => updateAdjust("action", e.target.value)}>
                  <option value="DECREASE">{t("Decrease")}</option>
                  <option value="INCREASE">{t("Increase")}</option>
                </select>
              </div>
              <div>
                <label>{t("Reason")}</label>
                <select value={adjustForm.reason} onChange={(e) => updateAdjust("reason", e.target.value)}>
                  <option value="DAMAGED">{t("Damaged")}</option>
                  <option value="LOST">{t("Lost")}</option>
                  <option value="RETURN">{t("Return")}</option>
                  <option value="CORRECTION">{t("Correction")}</option>
                  <option value="COUNT_VARIANCE">{t("Count Variance")}</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div><label>{t("Approved By")}</label><input value={adjustForm.approved_by} onChange={(e) => updateAdjust("approved_by", e.target.value)} /></div>
              <div><label>{t("Note")}</label><input value={adjustForm.note} onChange={(e) => updateAdjust("note", e.target.value)} /></div>
            </div>
            <button type="submit">{t("Record Adjustment")}</button>
          </form>
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Bulk Adjustment Import")}</h3>
        <p>{t("Format:")} `barcode,action,quantity,reason,approved_by`</p>
        <div className="row mt-12">
          <button type="button" onClick={() => fileInputRef.current?.click()}>{t("Import CSV File")}</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onBulkFilePicked(e.target.files?.[0])}
          />
          <button type="button" className="secondary" onClick={importBulkText}>{t("Apply Pasted Rows")}</button>
        </div>
        <textarea
          className="mt-12"
          rows="4"
          value={csvInput}
          onChange={(e) => setCsvInput(e.target.value)}
          placeholder={t("8850002,DECREASE,2,DAMAGED,Supervisor A")}
        />
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">{t("Low Stock Action Board")}</h3>
          <DataTable
            columns={[t("Product"), t("Barcode"), t("Category"), t("Supplier"), t("Qty"), t("Min"), t("Gap"), t("Action")]}
            rows={stockLowRows.map((x) => [
              x.product,
              x.barcode,
              x.category,
              x.supplier,
              x.qty,
              x.min,
              Math.max(0, x.min - x.qty),
              <div key={`act-${x.barcode}`} className="action-row">
                <button type="button" className="btn-inline" onClick={() => navigate("/products")}>{t("Open Product")}</button>
                <button type="button" className="btn-inline secondary" onClick={() => navigate("/notifications")}>{t("Create Alert")}</button>
              </div>
            ])}
            emptyText={t("No low stock")}
          />
        </article>

        <article className="card">
          <h3 className="card-title">{t("FEFO Batch Prioritization")}</h3>
          <DataTable
            columns={[t("Product"), t("Barcode"), t("Lot"), t("Qty"), t("Expiry"), t("Days Left"), t("Priority"), t("Action")]}
            rows={expiryRows.map((x) => [
              x.product,
              x.barcode,
              x.lot,
              x.qty,
              x.expiry,
              x.days_left,
              x.days_left <= 3 ? t("Critical") : x.days_left <= 7 ? t("High") : t("Normal"),
              <button key={`${x.barcode}-${x.lot}`} type="button" className="btn-inline" onClick={() => navigate("/sales")}>{t("View Source")}</button>
            ])}
            emptyText={t("No expiry risk")}
          />
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Stock Movement History (Audit Trail)")}</h3>
        <DataTable
          columns={[t("Time"), t("Store"), t("Product"), t("Barcode"), t("Type"), t("Qty"), t("Reason"), t("Approved By")]}
          rows={movementLog.map((m) => [m.time, t(m.store), m.product, m.barcode, t(m.type), m.qty, t(m.reason), m.approved_by || "-"])}
          emptyText={t("No movements recorded")}
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Alert Trigger Log")}</h3>
        <DataTable
          columns={[t("Time"), t("Store"), t("Type"), t("Details")]}
          rows={alertLog.map((a) => [a.time, t(a.store), t(a.type), a.details])}
          emptyText={t("No alert events")}
        />
      </section>

      {msg ? <div className="msg ok">{msg}</div> : null}
    </Layout>
  );
}
