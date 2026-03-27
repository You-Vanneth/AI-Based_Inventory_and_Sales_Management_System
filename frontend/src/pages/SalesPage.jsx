import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { t } from "../lib/i18n";
import { apiFetch } from "../lib/api";

const catalogSeed = [
  { id: 1, barcode: "8850001", product_name: "Coca Cola 330ml", stock: 24, price: 0.75, category: "Drink" },
  { id: 2, barcode: "8850002", product_name: "Instant Noodle", stock: 12, price: 0.45, category: "Food" },
  { id: 3, barcode: "8850003", product_name: "UHT Milk", stock: 8, price: 1.2, category: "Dairy" },
  { id: 4, barcode: "8850004", product_name: "Soy Sauce", stock: 4, price: 1.1, category: "Food" }
];

const QUEUED_SALES_STORAGE_KEY = "sales_queued_sales";
const NETWORK_MODE_STORAGE_KEY = "sales_network_online";

const toNumber = (value) => Number(value || 0);
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const normalizeSaleItem = (item) => ({
  ...item,
  qty: toNumber(item?.qty),
  unit_price: toNumber(item?.unit_price),
  line_total: toNumber(item?.line_total)
});

const normalizeSale = (sale) => ({
  ...sale,
  subtotal: toNumber(sale?.subtotal),
  discount_pct: toNumber(sale?.discount_pct),
  discount_amount: toNumber(sale?.discount_amount),
  tax_pct: toNumber(sale?.tax_pct),
  tax_amount: toNumber(sale?.tax_amount),
  total: toNumber(sale?.total),
  total_khr: toNumber(sale?.total_khr),
  paid_amount: toNumber(sale?.paid_amount),
  change: toNumber(sale?.change),
  payment_status: sale?.payment_status || "PAID",
  transaction_reference: sale?.transaction_reference || "",
  payment_proof_url: sale?.payment_proof_url || "",
  paid_at: sale?.paid_at || "",
  verified_by: sale?.verified_by || "",
  verified_at: sale?.verified_at || "",
  is_refund: Boolean(toNumber(sale?.is_refund) || sale?.is_refund),
  items: Array.isArray(sale?.items) ? sale.items.map(normalizeSaleItem) : []
});

const normalizeShiftClosure = (row) => ({
  ...row,
  id: toNumber(row?.id),
  opening_cash: toNumber(row?.opening_cash),
  cash_in: toNumber(row?.cash_in),
  cash_out: toNumber(row?.cash_out),
  cash_sales_total: toNumber(row?.cash_sales_total),
  expected_drawer: toNumber(row?.expected_drawer),
  note: row?.note || "",
  created_by: row?.created_by || "-",
  created_at: row?.created_at || "-"
});

function persistQueuedSales(sales) {
  try {
    localStorage.setItem(QUEUED_SALES_STORAGE_KEY, JSON.stringify(sales));
  } catch {
    // ignore storage write failures
  }
}

export default function SalesPage() {
  const [catalog, setCatalog] = useState(catalogSeed);
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState(0);
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [bankTransferOptions, setBankTransferOptions] = useState([]);
  const [bankTransferForm, setBankTransferForm] = useState({
    qr_image_url: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    notes: "",
    last_uploaded_by: "",
    last_uploaded_at: "",
    updated_by: "",
    updated_at: ""
  });
  const [editingBankTransferId, setEditingBankTransferId] = useState(null);
  const [savingBankSettings, setSavingBankSettings] = useState(false);
  const [markingPaidSaleId, setMarkingPaidSaleId] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [khrRate, setKhrRate] = useState(4100);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [recentSales, setRecentSales] = useState([]);
  const [shiftClosures, setShiftClosures] = useState([]);
  const [queuedSales, setQueuedSales] = useState(() => {
    try {
      const stored = localStorage.getItem(QUEUED_SALES_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map(normalizeSale) : [];
    } catch {
      return [];
    }
  });
  const [networkOnline, setNetworkOnline] = useState(() => {
    try {
      const stored = localStorage.getItem(NETWORK_MODE_STORAGE_KEY);
      if (stored === "ONLINE") return true;
      if (stored === "OFFLINE") return false;
    } catch {
      // ignore storage read failures
    }
    return true;
  });
  const [msg, setMsg] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [scannerMsg, setScannerMsg] = useState("");
  const [manualScanValue, setManualScanValue] = useState("");
  const [shiftStartCash, setShiftStartCash] = useState(100);
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [shiftCloseNote, setShiftCloseNote] = useState("");
  const [closingShift, setClosingShift] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState("");
  const [refundReason, setRefundReason] = useState(t("Wrong item"));
  const syncInFlightRef = useRef(false);

  const loadCatalog = async () => {
    const res = await apiFetch("/products");
    const rows = Array.isArray(res?.data) ? res.data : [];
    setCatalog(
      rows.map((p) => ({
        id: p.id,
        barcode: p.barcode,
        product_name: p.product_name,
        stock: Number(p.quantity || 0),
        price: Number(p.selling_price || 0),
        category: p.category_name || "General"
      }))
    );
  };

  const loadRecentSales = async () => {
    const res = await apiFetch("/sales?limit=20");
    setRecentSales(Array.isArray(res?.data) ? res.data.map(normalizeSale) : []);
  };

  const loadShiftClosures = async () => {
    const res = await apiFetch("/sales/shift-closures");
    setShiftClosures(Array.isArray(res?.data) ? res.data.map(normalizeShiftClosure) : []);
  };

  const loadBankTransferSettings = async () => {
    const res = await apiFetch("/bank-transfer-settings");
    const rows = Array.isArray(res?.data) ? res.data : [];
    setBankTransferOptions(rows);
  };

  useEffect(() => {
    loadCatalog().catch(() => {});
    loadRecentSales().catch(() => {});
    loadShiftClosures().catch(() => {});
    loadBankTransferSettings().catch(() => {});
  }, []);

  useEffect(() => {
    persistQueuedSales(queuedSales);
  }, [queuedSales]);

  useEffect(() => {
    try {
      localStorage.setItem(NETWORK_MODE_STORAGE_KEY, networkOnline ? "ONLINE" : "OFFLINE");
    } catch {
      // ignore storage write failures
    }
  }, [networkOnline]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);

  const subtotal = useMemo(() => cart.reduce((sum, x) => sum + x.line_total, 0), [cart]);
  const discountAmount = useMemo(() => Number((subtotal * (Number(discountPct || 0) / 100)).toFixed(2)), [subtotal, discountPct]);
  const taxable = Number((subtotal - discountAmount).toFixed(2));
  const taxAmount = useMemo(() => Number((taxable * (Number(taxPct || 0) / 100)).toFixed(2)), [taxable, taxPct]);
  const total = Number((taxable + taxAmount).toFixed(2));
  const totalKhr = Number((total * Number(khrRate || 0)).toFixed(0));
  const change = Number((Number(paidAmount || 0) - total).toFixed(2));
  const cashSalesTotal = useMemo(
    () => recentSales.filter((s) => s.payment_method === "CASH" && !s.is_refund).reduce((sum, s) => sum + toNumber(s.total), 0),
    [recentSales]
  );
  const expectedDrawer = Number((Number(shiftStartCash || 0) + Number(cashSalesTotal || 0) + Number(cashIn || 0) - Number(cashOut || 0)).toFixed(2));

  const visibleCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const availableStock = (barcodeValue) => {
    const product = catalog.find((p) => p.barcode === barcodeValue);
    return Number(product?.stock || 0);
  };

  const cartQtyFor = (barcodeValue) => Number(cart.find((x) => x.barcode === barcodeValue)?.qty || 0);

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

  const createBarcodeDetector = async () => {
    if (!("BarcodeDetector" in window)) {
      throw new Error(t("BarcodeDetector is not supported in this browser. Use manual input or USB scanner."));
    }

    const requestedFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
    let formats = requestedFormats;

    if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const filtered = requestedFormats.filter((format) => supported.includes(format));
      if (filtered.length) formats = filtered;
      else if (supported.length) formats = supported;
    }

    try {
      return new window.BarcodeDetector({ formats });
    } catch {
      return new window.BarcodeDetector();
    }
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes?.length && barcodes[0]?.rawValue) {
        const code = String(barcodes[0].rawValue).trim();
        setBarcode(code);
        setMsg(`${t("Barcode detected")}: ${code}`);
        setShowScanner(false);
        stopScanner();
        return;
      }
    } catch {
      // keep scanning
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startScanner = async () => {
    setScannerMsg("");
    setManualScanValue("");
    setShowScanner(true);
    if (!("BarcodeDetector" in window)) {
      setScannerMsg(t("BarcodeDetector is not supported in this browser. Use manual input or USB scanner."));
      return;
    }
    try {
      detectorRef.current = await createBarcodeDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = null;
      await videoRef.current.play().catch(() => {});
      const startLoop = () => {
        rafRef.current = requestAnimationFrame(scanLoop);
      };
      if (videoRef.current.readyState >= 2) startLoop();
      else videoRef.current.onloadedmetadata = startLoop;
    } catch (error) {
      setScannerMsg(`${t("Unable to start camera scanner")}: ${error.message}`);
      stopScanner();
    }
  };

  const closeScanner = () => {
    setShowScanner(false);
    setManualScanValue("");
    stopScanner();
  };

  const applyManualScan = () => {
    const scanned = manualScanValue.trim();
    if (!scanned) {
      setScannerMsg(t("Please enter a barcode."));
      return;
    }
    setBarcode(scanned);
    setMsg(`${t("Barcode detected")}: ${scanned}`);
    closeScanner();
  };

  const addProductToCart = (found, quantity) => {
    const q = Number(quantity || 1);
    if (q < 1) return;
    const available = availableStock(found.barcode);
    const alreadyInCart = cartQtyFor(found.barcode);
    if (alreadyInCart + q > available) {
      setMsg(`${t("Not enough stock. Available")}: ${Math.max(0, available - alreadyInCart)}`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.barcode === found.barcode);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + q;
        next[idx] = { ...next[idx], qty: newQty, line_total: Number((newQty * next[idx].unit_price).toFixed(2)) };
        return next;
      }
      return [
        ...prev,
        {
          barcode: found.barcode,
          product_name: found.product_name,
          qty: q,
          unit_price: found.price,
          line_total: Number((q * found.price).toFixed(2))
        }
      ];
    });
    setMsg("");
  };

  const addItemByBarcode = () => {
    const b = barcode.trim();
    if (!b) return;
    const found = catalog.find((p) => p.barcode === b);
    if (!found) {
      setMsg(t("Product not found."));
      return;
    }
    addProductToCart(found, qty);
    setBarcode("");
    setQty(1);
  };

  const removeItem = (barcodeToRemove) => {
    setCart((prev) => prev.filter((x) => x.barcode !== barcodeToRemove));
  };

  const resetCheckout = () => {
    setCart([]);
    setPaidAmount(0);
    setTransactionReference("");
    setPaymentProofUrl("");
    setDiscountPct(0);
    setTaxPct(0);
  };

  const saveBankTransferSettings = async () => {
    setSavingBankSettings(true);
    setMsg("");
    try {
      const res = await apiFetch(editingBankTransferId ? `/bank-transfer-settings/${editingBankTransferId}` : "/bank-transfer-settings", {
        method: editingBankTransferId ? "PUT" : "POST",
        body: JSON.stringify(bankTransferForm)
      });
      const saved = res?.data || {};
      setBankTransferOptions((prev) => {
        if (editingBankTransferId) {
          return prev.map((entry) => (Number(entry.id) === Number(saved.id) ? saved : entry));
        }
        return [saved, ...prev];
      });
      setBankTransferForm({
        qr_image_url: "",
        bank_name: "",
        account_name: "",
        account_number: "",
        notes: "",
        last_uploaded_by: "",
        last_uploaded_at: "",
        updated_by: "",
        updated_at: ""
      });
      setEditingBankTransferId(null);
      setMsg(t("Bank transfer settings saved."));
    } catch (err) {
      setMsg(`${t("Save failed")}: ${err.message}`);
    } finally {
      setSavingBankSettings(false);
    }
  };

  const editBankTransferSetting = (entry) => {
    setEditingBankTransferId(entry.id);
    setBankTransferForm({
      qr_image_url: entry.qr_image_url || "",
      bank_name: entry.bank_name || "",
      account_name: entry.account_name || "",
      account_number: entry.account_number || "",
      notes: entry.notes || "",
      last_uploaded_by: entry.last_uploaded_by || "",
      last_uploaded_at: entry.last_uploaded_at || "",
      updated_by: entry.updated_by || "",
      updated_at: entry.updated_at || ""
    });
  };

  const resetBankTransferForm = () => {
    setEditingBankTransferId(null);
    setBankTransferForm({
      qr_image_url: "",
      bank_name: "",
      account_name: "",
      account_number: "",
      notes: "",
      last_uploaded_by: "",
      last_uploaded_at: "",
      updated_by: "",
      updated_at: ""
    });
  };

  const deleteBankTransferSetting = async (id) => {
    setMsg("");
    try {
      await apiFetch(`/bank-transfer-settings/${id}`, { method: "DELETE" });
      setBankTransferOptions((prev) => prev.filter((entry) => Number(entry.id) !== Number(id)));
      if (Number(editingBankTransferId) === Number(id)) resetBankTransferForm();
      setMsg(t("Bank transfer setting deleted."));
    } catch (err) {
      setMsg(`${t("Delete failed")}: ${err.message}`);
    }
  };

  const createSale = async () => {
    setMsg("");
    if (!cart.length) {
      setMsg(t("Cart is empty."));
      return;
    }
    if (paymentMethod === "CASH" && Number(paidAmount || 0) < total) {
      setMsg(t("Paid amount is less than total."));
      return;
    }

    if (!networkOnline) {
      const sale = {
        sale_id: Date.now(),
        sale_time: new Date().toLocaleString(),
        items: cart,
        payment_method: paymentMethod,
        customer_name: customerName || "-",
        customer_phone: customerPhone || "-",
        subtotal,
        discount_pct: Number(discountPct || 0),
        discount_amount: discountAmount,
        tax_pct: Number(taxPct || 0),
        tax_amount: taxAmount,
        total,
        total_khr: totalKhr,
        paid_amount: paymentMethod === "BANK_TRANSFER" ? 0 : Number(Number(paidAmount).toFixed(2)),
        change: paymentMethod === "BANK_TRANSFER" ? 0 : Number(change.toFixed(2)),
        payment_status: paymentMethod === "BANK_TRANSFER" ? "PENDING" : "PAID",
        transaction_reference: transactionReference.trim(),
        payment_proof_url: paymentProofUrl,
        sync_status: "QUEUED",
        is_refund: false
      };
      const nextQueuedSales = [sale, ...queuedSales];
      persistQueuedSales(nextQueuedSales);
      setQueuedSales(nextQueuedSales);
      setRecentSales((prev) => [normalizeSale(sale), ...prev.slice(0, 19)]);
      setReceipt(normalizeSale(sale));
      setMsg(t("Network offline: sale queued for sync."));
      resetCheckout();
      setShowReceipt(true);
      return;
    }

    try {
      const payload = {
        items: cart.map((x) => ({ barcode: x.barcode, qty: Number(x.qty || 0) })),
        payment_method: paymentMethod,
        customer_name: customerName || "-",
        customer_phone: customerPhone || "-",
        discount_pct: Number(discountPct || 0),
        tax_pct: Number(taxPct || 0),
        khr_rate: Number(khrRate || 4100),
        paid_amount: paymentMethod === "BANK_TRANSFER" ? 0 : Number(Number(paidAmount).toFixed(2)),
        transaction_reference: transactionReference.trim(),
        payment_proof_url: paymentProofUrl
      };
      const res = await apiFetch("/sales", { method: "POST", body: JSON.stringify(payload) });
      const sale = normalizeSale(res?.data || {});
      setReceipt(sale);
      await loadRecentSales();
      await loadCatalog();
      setMsg(t("Sale created successfully."));
      resetCheckout();
      setShowReceipt(true);
    } catch (err) {
      setMsg(`${t("Create sale failed")}: ${err.message}`);
    }
  };

  const markSalePaid = async (sale) => {
    setMarkingPaidSaleId(String(sale.sale_id));
    setMsg("");
    try {
      const res = await apiFetch(`/sales/${sale.sale_id}/mark-paid`, {
        method: "PATCH",
        body: JSON.stringify({ transaction_reference: sale.transaction_reference || transactionReference.trim() })
      });
      const updated = normalizeSale(res?.data || {});
      setRecentSales((prev) => prev.map((entry) => (String(entry.sale_id) === String(updated.sale_id) ? updated : entry)));
      if (receipt && String(receipt.sale_id) === String(updated.sale_id)) setReceipt(updated);
      setMsg(t("Bank transfer marked as paid."));
    } catch (err) {
      setMsg(`${t("Mark as paid failed")}: ${err.message}`);
    } finally {
      setMarkingPaidSaleId("");
    }
  };

  const syncQueuedSales = async () => {
    if (syncInFlightRef.current) return;
    if (!networkOnline) {
      setMsg(t("Cannot sync while offline."));
      return;
    }
    if (!queuedSales.length) {
      setMsg(t("No queued sales."));
      return;
    }
    try {
      syncInFlightRef.current = true;
      for (const sale of queuedSales) {
        await apiFetch("/sales", {
          method: "POST",
          body: JSON.stringify({
            items: (sale.items || []).map((x) => ({ barcode: x.barcode, qty: Number(x.qty || 0) })),
            payment_method: sale.payment_method,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            discount_pct: sale.discount_pct,
            tax_pct: sale.tax_pct,
            khr_rate: khrRate,
            paid_amount: sale.paid_amount,
            transaction_reference: sale.transaction_reference || "",
            payment_proof_url: sale.payment_proof_url || ""
          })
        });
      }
      persistQueuedSales([]);
      setQueuedSales([]);
      await loadRecentSales();
      await loadCatalog();
      setMsg(t("Queued sales synced."));
    } catch (err) {
      setMsg(`${t("Sync failed")}: ${err.message}`);
    } finally {
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (networkOnline && queuedSales.length) {
      syncQueuedSales().catch(() => {});
    }
  }, [networkOnline, queuedSales.length]);

  const processRefund = async () => {
    const source = recentSales.find((s) => String(s.sale_id) === String(refundSaleId));
    if (!source) {
      setMsg(t("Sale ID not found."));
      return;
    }
    if (source.is_refund) {
      setMsg(t("Cannot refund a refund record."));
      return;
    }

    try {
      if (!networkOnline) {
        setMsg(t("Cannot process refund while offline."));
        return;
      }
      const res = await apiFetch("/sales/refund", {
        method: "POST",
        body: JSON.stringify({ sale_id: source.sale_id, reason: refundReason })
      });
      const refundedUnits = (source.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const refundReceipt = normalizeSale({
        ...source,
        ...(res?.data || {}),
        sale_id: res?.data?.sale_id || source.sale_id,
        sale_time: new Date().toLocaleString(),
        total: Number((-1 * Number(source.total || 0)).toFixed(2)),
        total_khr: Number((-1 * Number(source.total_khr || 0)).toFixed(0)),
        paid_amount: Number((-1 * Number(source.paid_amount || 0)).toFixed(2)),
        change: 0,
        is_refund: true,
        refund_reason: refundReason
      });
      await loadRecentSales();
      await loadCatalog();
      setShowRefund(false);
      setRefundSaleId("");
      setReceipt(refundReceipt);
      setShowReceipt(true);
      setMsg(`${t("Refund recorded.")} $${Math.abs(Number(source.total || 0)).toFixed(2)} ${t("refunded and")} ${refundedUnits} ${t("unit(s) returned to stock.")}`);
    } catch (err) {
      setMsg(`${t("Refund failed")}: ${err.message}`);
    }
  };

  const confirmShiftClose = async () => {
    if (!networkOnline) {
      setMsg(t("Cannot close shift while offline."));
      return;
    }
    try {
      setClosingShift(true);
      const res = await apiFetch("/sales/shift-close", {
        method: "POST",
        body: JSON.stringify({
          opening_cash: Number(shiftStartCash || 0),
          cash_in: Number(cashIn || 0),
          cash_out: Number(cashOut || 0),
          note: shiftCloseNote
        })
      });
      const saved = res?.data || {};
      await loadShiftClosures();
      setMsg(`${t("Shift close saved")}: ${t("Expected Drawer")} $${Number(saved.expected_drawer || expectedDrawer).toFixed(2)}`);
      setShowCloseShift(false);
      setShiftCloseNote("");
    } catch (err) {
      setMsg(`${t("Shift close failed")}: ${err.message}`);
    } finally {
      setClosingShift(false);
    }
  };

  return (
    <Layout title="Sales">
      <section className="hero">
        <h2>{t("Sales Console")}</h2>
        <p>{t("Sell by barcode and auto reduce stock.")}</p>
        <div className="row mt-12 sales-toolbar">
          <div>
            <label>{t("Network")}</label>
            <select value={networkOnline ? "ONLINE" : "OFFLINE"} onChange={(e) => setNetworkOnline(e.target.value === "ONLINE")}>
              <option value="ONLINE">{t("ONLINE")}</option>
              <option value="OFFLINE">{t("OFFLINE")}</option>
            </select>
          </div>
          <div>
            <label>{t("Queued Sales")}</label>
            <button type="button" onClick={syncQueuedSales}>{t("Sync")} ({queuedSales.length})</button>
          </div>
          <div>
            <label>{t("Exchange Rate (KHR/USD)")}</label>
            <input type="number" min="1" value={khrRate} onChange={(e) => setKhrRate(Number(e.target.value || 0))} />
          </div>
          <div>
            <label>{t("Shift")}</label>
            <button type="button" className="secondary" onClick={() => setShowCloseShift(true)}>{t("Close Shift")}</button>
          </div>
          <div>
            <label>{t("Refund")}</label>
            <button type="button" className="secondary" onClick={() => setShowRefund(true)}>{t("Process Refund")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Product Search Panel")}</h3>
        <div className="row">
          <div>
            <label>{t("Search Product")}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search by name, barcode, category")} />
          </div>
          <div>
            <label>{t("Qty")}</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div className="mt-12">
          <DataTable
            className="sales-catalog-table"
            columns={[t("Product"), t("Barcode"), t("Category"), t("Stock"), t("Price"), t("Action")]}
            rows={visibleCatalog.map((p) => [
              p.product_name,
              p.barcode,
              p.category,
              p.stock,
              `$${p.price.toFixed(2)}`,
              <button key={p.id} type="button" className="btn-inline" onClick={() => addProductToCart(p, qty)}>
                {t("Add")}
              </button>
            ])}
            emptyText="No product found"
          />
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("POS Cart")}</h3>
        <div className="row">
          <div><label>{t("Barcode")}</label><input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder={t("Scan or type barcode")} /></div>
          <div><label>{t("Qty")}</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        </div>
        <div className="row mt-12">
          <button type="button" onClick={addItemByBarcode}>{t("Add by Barcode")}</button>
          <button type="button" className="secondary" onClick={startScanner}>{t("Scan")}</button>
        </div>
        <div className="mt-16">
          <DataTable
            className="sales-cart-table"
            columns={[t("Product"), t("Barcode"), t("Qty"), t("Unit Price"), t("Line Total"), t("Action")]}
            rows={cart.map((x) => [
              x.product_name,
              x.barcode,
              x.qty,
              `$${x.unit_price.toFixed(2)}`,
              `$${x.line_total.toFixed(2)}`,
              <button key={x.barcode} type="button" className="btn-inline danger" onClick={() => removeItem(x.barcode)}>{t("Remove")}</button>
            ])}
            emptyText="No items"
          />
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Bank Transfer Settings")}</h3>
        <div className="row">
          <div>
            <label>{t("Bank Name")}</label>
            <input value={bankTransferForm.bank_name || ""} onChange={(e) => setBankTransferForm((prev) => ({ ...prev, bank_name: e.target.value }))} />
          </div>
          <div>
            <label>{t("Account Name")}</label>
            <input value={bankTransferForm.account_name || ""} onChange={(e) => setBankTransferForm((prev) => ({ ...prev, account_name: e.target.value }))} />
          </div>
        </div>
        <div className="row mt-12">
          <div>
            <label>{t("Account Number")}</label>
            <input value={bankTransferForm.account_number || ""} onChange={(e) => setBankTransferForm((prev) => ({ ...prev, account_number: e.target.value }))} />
          </div>
          <div>
            <label>{t("Bank QR Image")}</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await fileToDataUrl(file);
                  setBankTransferForm((prev) => ({ ...prev, qr_image_url: dataUrl }));
                } catch (err) {
                  setMsg(`${t("Upload failed")}: ${err.message}`);
                }
              }}
            />
          </div>
        </div>
        <div className="mt-12">
          <label>{t("Notes")}</label>
          <textarea value={bankTransferForm.notes || ""} onChange={(e) => setBankTransferForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} />
        </div>
        {bankTransferForm.qr_image_url ? (
          <div className="mt-12">
            <img src={bankTransferForm.qr_image_url} alt="Bank QR" style={{ maxWidth: "220px", borderRadius: "12px", border: "1px solid #d4deea" }} />
          </div>
        ) : null}
        {editingBankTransferId && bankTransferForm.updated_by ? (
          <div className="mt-12 muted">
            {t("Updated by")}: {bankTransferForm.updated_by} {bankTransferForm.updated_at ? `• ${bankTransferForm.updated_at}` : ""}
          </div>
        ) : null}
        <div className="row mt-12">
          <button type="button" className="secondary" onClick={saveBankTransferSettings} disabled={savingBankSettings}>
            {savingBankSettings ? t("Saving...") : editingBankTransferId ? t("Update Bank QR") : t("Save Bank QR")}
          </button>
        </div>
        <div className="mt-16">
          <DataTable
            columns={[t("Bank Name"), t("Account Name"), t("Account Number"), t("Updated by"), t("Action")]}
            rows={bankTransferOptions.map((entry) => [
              entry.bank_name || "-",
              entry.account_name || "-",
              entry.account_number || "-",
              entry.updated_by || "-",
              <div key={entry.id} className="action-row">
                <button type="button" className="btn-inline" onClick={() => editBankTransferSetting(entry)}>{t("Edit")}</button>
                <button type="button" className="btn-inline danger" onClick={() => deleteBankTransferSetting(entry.id)}>{t("Delete")}</button>
              </div>
            ])}
            emptyText="No bank QR saved"
          />
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Payment")}</h3>
        <div className="row">
          <div>
            <label>{t("Customer Name (Optional)")}</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label>{t("Customer Phone (Optional)")}</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>
        <div className="row mt-12">
          <div>
            <label>{t("Payment Method")}</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">{t("CASH")}</option>
              <option value="BANK_TRANSFER">{t("BANK_TRANSFER")}</option>
            </select>
          </div>
          <div>
            <label>{t("Paid Amount (USD)")}</label>
            <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} disabled={paymentMethod === "BANK_TRANSFER"} />
          </div>
        </div>
        {paymentMethod === "BANK_TRANSFER" ? (
          <>
            <div className="row mt-12">
              <div>
                <label>{t("Transaction Reference")}</label>
                <input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder={t("Optional bank transfer reference")} />
              </div>
              <div>
                <label>{t("Payment Proof")}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setPaymentProofUrl(await fileToDataUrl(file));
                    } catch (err) {
                      setMsg(`${t("Upload failed")}: ${err.message}`);
                    }
                  }}
                />
              </div>
            </div>
            {bankTransferOptions.length ? (
              <div className="grid grid-2 mt-12">
                <div className="card" style={{ minHeight: "360px", display: "grid", alignContent: "start" }}>
                  <div className="kpi-label">{t("Customer Scan QR")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px", marginTop: "14px" }}>
                    {bankTransferOptions.map((entry) => (
                      <div key={entry.id} className="card" style={{ minHeight: "460px", display: "grid", alignContent: "start", gap: "14px", padding: "20px" }}>
                        <div className="kpi-label">{entry.bank_name || t("Bank QR")}</div>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "340px" }}>
                          {entry.qr_image_url ? (
                            <img src={entry.qr_image_url} alt={entry.bank_name || "Bank QR"} style={{ maxWidth: "300px", maxHeight: "300px", borderRadius: "16px", border: "1px solid #d4deea" }} />
                          ) : (
                            <span className="muted">{t("No QR image")}</span>
                          )}
                        </div>
                        <div className="muted">{entry.account_name || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card" style={{ minHeight: "360px", display: "grid", alignContent: "start" }}>
                  <div className="kpi-label">{t("Bank Transfer Details")}</div>
                  <p className="mt-12"><strong>{t("Amount Due")}:</strong> ${total.toFixed(2)} / ៛{totalKhr.toLocaleString()}</p>
                  <p className="mt-12"><strong>{t("Payment Status")}:</strong> {t("PENDING")}</p>
                  <p className="mt-12"><strong>{t("Available Bank QR")}:</strong> {bankTransferOptions.map((entry) => entry.bank_name || entry.account_name || entry.account_number || "-").join(", ")}</p>
                  <div className="mt-12" style={{ display: "grid", gap: "10px" }}>
                    {bankTransferOptions.map((entry) => (
                      <div key={entry.id} className="card" style={{ padding: "12px 14px" }}>
                        <div><strong>{t("Bank Name")}:</strong> {entry.bank_name || "-"}</div>
                        <div className="mt-12"><strong>{t("Account Name")}:</strong> {entry.account_name || "-"}</div>
                        <div className="mt-12"><strong>{t("Account Number")}:</strong> {entry.account_number || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="row mt-12">
          <div>
            <label>{t("Discount %")}</label>
            <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value || 0))} />
          </div>
          <div>
            <label>{t("Tax %")}</label>
            <input type="number" min="0" max="100" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value || 0))} />
          </div>
        </div>
        <div className="grid grid-2 mt-12">
          <div className="kpi"><div className="kpi-label">{t("Subtotal USD")}</div><div className="kpi-value">${subtotal.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Discount")}</div><div className="kpi-value">${discountAmount.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Tax")}</div><div className="kpi-value">${taxAmount.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Total USD / KHR")}</div><div className="kpi-value">${total.toFixed(2)} / ៛{totalKhr.toLocaleString()}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Change USD")}</div><div className="kpi-value">${(paymentMethod === "BANK_TRANSFER" ? 0 : isNaN(change) ? 0 : change).toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Items")}</div><div className="kpi-value">{cart.reduce((sum, x) => sum + Number(x.qty), 0)}</div></div>
        </div>
        <button type="button" className="mt-12" onClick={createSale}>{t("Create Sale")}</button>
        {msg ? <div className="msg ok">{msg}</div> : null}
      </section>

      <section className="card">
        <h3 className="card-title">{t("Cash Drawer Reconciliation")}</h3>
        <div className="row">
          <div>
            <label>{t("Opening Cash")}</label>
            <input type="number" min="0" step="0.01" value={shiftStartCash} onChange={(e) => setShiftStartCash(Number(e.target.value || 0))} />
          </div>
          <div>
            <label>{t("Cash In")}</label>
            <input type="number" min="0" step="0.01" value={cashIn} onChange={(e) => setCashIn(Number(e.target.value || 0))} />
          </div>
          <div>
            <label>{t("Cash Out")}</label>
            <input type="number" min="0" step="0.01" value={cashOut} onChange={(e) => setCashOut(Number(e.target.value || 0))} />
          </div>
        </div>
        <div className="grid grid-2 mt-12">
          <div className="kpi"><div className="kpi-label">{t("Cash Sales Total")}</div><div className="kpi-value">${cashSalesTotal.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Expected Drawer")}</div><div className="kpi-value">${expectedDrawer.toFixed(2)}</div></div>
        </div>
        <button type="button" className="secondary mt-12" onClick={() => setShowCloseShift(true)}>{t("Close Shift Summary")}</button>
      </section>

      <section className="card">
        <h3 className="card-title">{t("Recent Sales")}</h3>
        <DataTable
          className="sales-history-table"
          columns={[t("Sale ID"), t("Date"), t("Customer"), t("Items"), t("Total"), t("Method"), t("Payment Status"), t("Sync"), t("Type"), t("Action")]}
          rows={recentSales.map((s) => [
            s.sale_id,
            s.sale_time,
            s.customer_name || "-",
            s.items.length,
            `${s.total >= 0 ? "$" : "-$"}${Math.abs(s.total).toFixed(2)}`,
            t(s.payment_method),
            t(s.payment_status || "PAID"),
            t(s.sync_status || "SYNCED"),
            s.is_refund ? t("REFUND") : t("SALE"),
            <div key={s.sale_id} className="action-row">
              <button type="button" className="btn-inline" onClick={() => { setReceipt(s); setShowReceipt(true); }}>{t("Detail")}</button>
              {s.payment_method === "BANK_TRANSFER" && !s.is_refund && s.payment_status !== "PAID" ? (
                <button type="button" className="btn-inline secondary" disabled={markingPaidSaleId === String(s.sale_id)} onClick={() => markSalePaid(s)}>
                  {markingPaidSaleId === String(s.sale_id) ? t("Saving...") : t("Mark as Paid")}
                </button>
              ) : null}
            </div>
          ])}
          emptyText="No recent sales"
        />
      </section>

      <section className="card">
        <h3 className="card-title">{t("Shift Closure History")}</h3>
        <DataTable
          className="shift-closure-table"
          columns={[t("ID"), t("Date"), t("Opening Cash"), t("Cash In"), t("Cash Out"), t("Cash Sales"), t("Expected Drawer"), t("Created By"), t("Note")]}
          rows={shiftClosures.map((x) => [
            x.id,
            x.created_at,
            `$${x.opening_cash.toFixed(2)}`,
            `$${x.cash_in.toFixed(2)}`,
            `$${x.cash_out.toFixed(2)}`,
            `$${x.cash_sales_total.toFixed(2)}`,
            `$${x.expected_drawer.toFixed(2)}`,
            x.created_by,
            x.note || "-"
          ])}
          emptyText="No shift closures yet"
        />
      </section>

      <Modal open={showScanner} onClose={closeScanner} title={t("Scan Barcode")}>
        <p className="mb-14">{t("Point your camera at a barcode to fill the barcode field.")}</p>
        <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
        {scannerMsg ? <div className="msg error">{scannerMsg}</div> : null}
        <div className="scanner-manual">
          <label>{t("Manual Barcode Entry")}</label>
          <div className="scanner-manual-row">
            <input
              value={manualScanValue}
              onChange={(e) => setManualScanValue(e.target.value)}
              placeholder={t("Enter barcode manually")}
            />
            <button type="button" className="secondary" onClick={applyManualScan}>{t("Use Barcode")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title={t("Receipt")} size="wide">
        {receipt ? (
          <div className="grid">
            <div className="grid grid-2">
              <div><strong>{t("Sale ID")}:</strong> {receipt.sale_id}</div>
              <div><strong>{t("Date")}:</strong> {receipt.sale_time}</div>
              <div><strong>{t("Method")}:</strong> {t(receipt.payment_method)}</div>
              <div><strong>{t("Customer")}:</strong> {receipt.customer_name || "-"}</div>
              <div><strong>{t("Payment Status")}:</strong> {t(receipt.payment_status || "PAID")}</div>
              <div><strong>{t("Sync")}:</strong> {t(receipt.sync_status || "SYNCED")}</div>
              {receipt.transaction_reference ? <div><strong>{t("Transaction Reference")}:</strong> {receipt.transaction_reference}</div> : <div />}
              {receipt.verified_by ? <div><strong>{t("Verified By")}:</strong> {receipt.verified_by}</div> : <div />}
              <div><strong>{t("Type")}:</strong> {receipt.is_refund ? t("REFUND") : t("SALE")}</div>
            </div>
            {receipt.payment_proof_url ? (
              <div>
                <div className="kpi-label">{t("Payment Proof")}</div>
                <img src={receipt.payment_proof_url} alt="Payment proof" style={{ maxWidth: "220px", marginTop: "10px", borderRadius: "12px", border: "1px solid #d4deea" }} />
              </div>
            ) : null}
            <DataTable
              columns={[t("Product"), t("Qty"), t("Unit"), t("Line Total")]}
              rows={receipt.items.map((i) => [i.product_name, i.qty, `$${i.unit_price.toFixed(2)}`, `$${i.line_total.toFixed(2)}`])}
            />
            <div className="grid grid-2">
              <div className="kpi"><div className="kpi-label">{t("Subtotal")}</div><div className="kpi-value">${Math.abs(receipt.subtotal).toFixed(2)}</div></div>
              <div className="kpi"><div className="kpi-label">{t("Discount")}</div><div className="kpi-value">${Math.abs(receipt.discount_amount || 0).toFixed(2)}</div></div>
              <div className="kpi"><div className="kpi-label">{t("Tax")}</div><div className="kpi-value">${Math.abs(receipt.tax_amount || 0).toFixed(2)}</div></div>
              <div className="kpi"><div className="kpi-label">{t("Total")}</div><div className="kpi-value">${Math.abs(receipt.total).toFixed(2)} / ៛{Math.abs(receipt.total_khr || 0).toLocaleString()}</div></div>
            </div>
            <button type="button" onClick={() => window.print()}>{t("Print Receipt")}</button>
          </div>
        ) : null}
      </Modal>

      <Modal open={showCloseShift} onClose={() => setShowCloseShift(false)} title={t("Close Shift")}>
        <div className="grid">
          <div className="kpi"><div className="kpi-label">{t("Opening Cash")}</div><div className="kpi-value">${Number(shiftStartCash || 0).toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Cash Sales")}</div><div className="kpi-value">${Number(cashSalesTotal || 0).toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Cash In / Out")}</div><div className="kpi-value">${Number(cashIn || 0).toFixed(2)} / ${Number(cashOut || 0).toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("Expected Drawer")}</div><div className="kpi-value">${expectedDrawer.toFixed(2)}</div></div>
          <div>
            <label>{t("Note")}</label>
            <input value={shiftCloseNote} onChange={(e) => setShiftCloseNote(e.target.value)} placeholder={t("Optional shift close note")} />
          </div>
          <button type="button" onClick={confirmShiftClose} disabled={closingShift}>
            {closingShift ? t("Saving...") : t("Confirm Shift Close")}
          </button>
        </div>
      </Modal>

      <Modal open={showRefund} onClose={() => setShowRefund(false)} title={t("Process Refund")}>
        <div className="grid">
          <div>
            <label>{t("Sale ID")}</label>
            <input value={refundSaleId} onChange={(e) => setRefundSaleId(e.target.value)} placeholder={t("Enter sale ID to refund")} />
          </div>
          <div>
            <label>{t("Reason")}</label>
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          </div>
          <button type="button" onClick={processRefund}>{t("Submit Refund")}</button>
        </div>
      </Modal>
    </Layout>
  );
}
