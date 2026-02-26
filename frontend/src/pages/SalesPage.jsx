import React from "react";
import { useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { t } from "../lib/i18n";

const productCatalog = [
  { id: 1, barcode: "8850001", product_name: "Coca Cola 330ml", stock: 24, price: 0.75 },
  { id: 2, barcode: "8850002", product_name: "Instant Noodle", stock: 12, price: 0.45 },
  { id: 3, barcode: "8850003", product_name: "UHT Milk", stock: 8, price: 1.2 }
];

export default function SalesPage() {
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState(0);
  const [recentSales, setRecentSales] = useState([]);
  const [msg, setMsg] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [showScanner, setShowScanner] = useState(false);
  const [scannerMsg, setScannerMsg] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);

  const subtotal = useMemo(() => cart.reduce((sum, x) => sum + x.line_total, 0), [cart]);
  const change = Number((Number(paidAmount || 0) - subtotal).toFixed(2));

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        const code = String(barcodes[0].rawValue).trim();
        setBarcode(code);
        setMsg(`Barcode detected: ${code}`);
        setShowScanner(false);
        stopScanner();
        return;
      }
    } catch {
      // continue scanning
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startScanner = async () => {
    setScannerMsg("");

    if (!("mediaDevices" in navigator) || !("getUserMedia" in navigator.mediaDevices)) {
      setScannerMsg("Camera is not supported in this browser.");
      return;
    }

    if (!("BarcodeDetector" in window)) {
      setScannerMsg("BarcodeDetector is not supported in this browser. Use manual input or USB scanner.");
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
      setScannerMsg(`Unable to start camera scanner: ${error.message}`);
      stopScanner();
    }
  };

  const closeScanner = () => {
    setShowScanner(false);
    stopScanner();
  };

  const addItem = () => {
    setMsg("");
    const b = barcode.trim();
    if (!b) return;
    const found = productCatalog.find((p) => p.barcode === b);
    if (!found) {
      setMsg("Product not found.");
      return;
    }

    const q = Number(qty || 1);
    if (q < 1) return;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.barcode === found.barcode);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + q;
        next[idx] = { ...next[idx], qty: newQty, line_total: Number((newQty * next[idx].unit_price).toFixed(2)) };
        return next;
      }
      return [...prev, {
        barcode: found.barcode,
        product_name: found.product_name,
        qty: q,
        unit_price: found.price,
        line_total: Number((q * found.price).toFixed(2))
      }];
    });

    setBarcode("");
    setQty(1);
  };

  const removeItem = (barcodeToRemove) => {
    setCart((prev) => prev.filter((x) => x.barcode !== barcodeToRemove));
  };

  const createSale = () => {
    setMsg("");
    if (!cart.length) {
      setMsg("Cart is empty.");
      return;
    }
    if (Number(paidAmount || 0) < subtotal) {
      setMsg("Paid amount is less than total.");
      return;
    }

    const sale = {
      sale_id: Date.now(),
      sale_time: new Date().toLocaleString(),
      items: cart,
      payment_method: paymentMethod,
      subtotal: Number(subtotal.toFixed(2)),
      paid_amount: Number(Number(paidAmount).toFixed(2)),
      change: Number(change.toFixed(2))
    };

    setReceipt(sale);
    setRecentSales((prev) => [sale, ...prev.slice(0, 9)]);
    setCart([]);
    setPaidAmount(0);
    setShowReceipt(true);
    setMsg("Sale created successfully.");
  };

  return (
    <Layout title="Sales">
      <section className="hero">
        <h2>{t("Sales Console")}</h2>
        <p>{t("Sell by barcode and auto reduce stock.")}</p>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h3 className="card-title">POS Cart</h3>
          <div className="row">
            <div><label>{t("Barcode")}</label><input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type barcode" /></div>
            <div><label>{t("Qty")}</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          </div>
          <div className="row mt-12">
            <button type="button" onClick={addItem}>Add Item</button>
            <button type="button" className="secondary" onClick={startScanner}>Scan</button>
          </div>

          <div className="mt-16">
            <DataTable
              columns={["Product", "Barcode", "Qty", "Unit Price", "Line Total", "Action"]}
              rows={cart.map((x) => [
                x.product_name,
                x.barcode,
                x.qty,
                `$${x.unit_price.toFixed(2)}`,
                `$${x.line_total.toFixed(2)}`,
                <button key={x.barcode} type="button" className="btn-inline danger" onClick={() => removeItem(x.barcode)}>Remove</button>
              ])}
              emptyText="No items"
            />
          </div>
        </article>

        <article className="card">
          <h3 className="card-title">Payment</h3>
          <div className="kpi"><div className="kpi-label">Subtotal</div><div className="kpi-value">${subtotal.toFixed(2)}</div></div>
          <div className="row mt-12">
            <div>
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="E_WALLET">E_WALLET</option>
              </select>
            </div>
            <div>
              <label>Paid Amount</label>
              <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-2 mt-12">
            <div className="kpi"><div className="kpi-label">Change</div><div className="kpi-value">${(isNaN(change) ? 0 : change).toFixed(2)}</div></div>
            <div className="kpi"><div className="kpi-label">Items</div><div className="kpi-value">{cart.reduce((sum, x) => sum + Number(x.qty), 0)}</div></div>
          </div>

          <button type="button" className="mt-12" onClick={createSale}>Create Sale</button>
          {msg ? <div className="msg ok">{msg}</div> : null}
        </article>
      </section>

      <section className="card">
        <h3 className="card-title">Recent Sales</h3>
        <DataTable
          columns={["Sale ID", "Date", "Items", "Total", "Method", "Action"]}
          rows={recentSales.map((s) => [
            s.sale_id,
            s.sale_time,
            s.items.length,
            `$${s.subtotal.toFixed(2)}`,
            s.payment_method,
            <button key={s.sale_id} type="button" className="btn-inline" onClick={() => { setReceipt(s); setShowReceipt(true); }}>Detail</button>
          ])}
          emptyText="No recent sales"
        />
      </section>

      <Modal open={showScanner} onClose={closeScanner} title="Scan Barcode">
        <p className="mb-14">Point your camera at a barcode to fill the barcode field.</p>
        <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
        {scannerMsg ? <div className="msg error">{scannerMsg}</div> : null}
      </Modal>

      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="Receipt" size="wide">
        {receipt ? (
          <div className="grid">
            <div className="grid grid-2">
              <div><strong>Sale ID:</strong> {receipt.sale_id}</div>
              <div><strong>Date:</strong> {receipt.sale_time}</div>
              <div><strong>Method:</strong> {receipt.payment_method}</div>
              <div><strong>Paid:</strong> ${receipt.paid_amount.toFixed(2)}</div>
            </div>
            <DataTable
              columns={["Product", "Qty", "Unit", "Line Total"]}
              rows={receipt.items.map((i) => [i.product_name, i.qty, `$${i.unit_price.toFixed(2)}`, `$${i.line_total.toFixed(2)}`])}
            />
            <div className="grid grid-2">
              <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">${receipt.subtotal.toFixed(2)}</div></div>
              <div className="kpi"><div className="kpi-label">Change</div><div className="kpi-value">${receipt.change.toFixed(2)}</div></div>
            </div>
            <button type="button" onClick={() => window.print()}>Print Receipt</button>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}
