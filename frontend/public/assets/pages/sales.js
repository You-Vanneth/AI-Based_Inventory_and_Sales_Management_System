App.requireAuth();
App.renderNav("sales");
const tr = App.t;

const salesBody = document.getElementById("salesBody");
const saleModal = document.getElementById("saleDetailModal");
const saleDetailContent = document.getElementById("saleDetailContent");
const closeSaleModal = document.getElementById("closeSaleModal");
const saleMsg = document.getElementById("saleMsg");
const listMsg = document.getElementById("listMsg");

const barcodeInput = document.getElementById("barcode");
const qtyInput = document.getElementById("qty");
const paidAmountInput = document.getElementById("paid_amount");
const payMethodInput = document.getElementById("pay_method");
const findSaleProductBtn = document.getElementById("findSaleProductBtn");
const saleProductPreview = document.getElementById("saleProductPreview");

const scanSaleBtn = document.getElementById("scanSaleBtn");
const saleScannerModal = document.getElementById("saleScannerModal");
const closeSaleScannerBtn = document.getElementById("closeSaleScannerBtn");
const saleScannerVideo = document.getElementById("saleScannerVideo");
const saleScannerMsg = document.getElementById("saleScannerMsg");
const saleScannerHint = document.getElementById("saleScannerHint");

let selectedProduct = null;
let scannerStream = null;
let scanLoopId = null;
let barcodeDetector = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openSaleModal(html) {
  saleDetailContent.innerHTML = html;
  saleModal.classList.remove("hidden");
}

function closeModal() {
  saleModal.classList.add("hidden");
}

function setProductPreview(product) {
  if (!product) {
    saleProductPreview.classList.add("hidden");
    saleProductPreview.innerHTML = "";
    return;
  }

  const qty = Number(qtyInput.value || 1);
  const total = (Number(product.selling_price) || 0) * qty;

  saleProductPreview.classList.remove("hidden");
  saleProductPreview.innerHTML = `
    <div><strong>${escapeHtml(product.product_name)}</strong></div>
    <div>${tr("Barcode")}: ${escapeHtml(product.barcode)}</div>
    <div>${tr("Stock")}: <strong>${product.quantity}</strong></div>
    <div>${tr("Unit Price")}: <strong>${product.selling_price}</strong></div>
    <div>${tr("Estimated Total")} (${qty}): <strong>${total.toFixed(2)}</strong></div>
  `;

  if (!paidAmountInput.value) {
    paidAmountInput.value = total.toFixed(2);
  }
}

async function findProductByBarcode() {
  saleMsg.innerHTML = "";
  const barcode = barcodeInput.value.trim();
  if (!barcode) {
    selectedProduct = null;
    setProductPreview(null);
    saleMsg.innerHTML = `<div class="msg error">${tr("Please enter or scan barcode first.")}</div>`;
    return null;
  }

  try {
    const productRes = await App.apiFetch(`/products/by-barcode/${encodeURIComponent(barcode)}`);
    selectedProduct = productRes.data;
    setProductPreview(selectedProduct);
    return selectedProduct;
  } catch (error) {
    selectedProduct = null;
    setProductPreview(null);
    saleMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
    return null;
  }
}

async function initDetector() {
  if (!("BarcodeDetector" in window)) {
    return null;
  }

  try {
    return new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"]
    });
  } catch {
    return new window.BarcodeDetector();
  }
}

function stopScanner() {
  if (scanLoopId) {
    cancelAnimationFrame(scanLoopId);
    scanLoopId = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  saleScannerVideo.srcObject = null;
}

function closeScannerModal() {
  stopScanner();
  saleScannerModal.classList.add("hidden");
  saleScannerMsg.innerHTML = "";
}

async function scanFrame() {
  if (!barcodeDetector || !saleScannerVideo || saleScannerVideo.readyState < 2) {
    scanLoopId = requestAnimationFrame(scanFrame);
    return;
  }

  try {
    const codes = await barcodeDetector.detect(saleScannerVideo);
    if (codes.length > 0 && codes[0].rawValue) {
      barcodeInput.value = codes[0].rawValue;
      saleScannerMsg.innerHTML = `<div class="msg ok">${tr("Barcode detected.")}</div>`;
      setTimeout(async () => {
        closeScannerModal();
        await findProductByBarcode();
      }, 250);
      return;
    }
  } catch {
    saleScannerMsg.innerHTML = `<div class="msg error">${tr("Scanner could not read barcode. Try better lighting.")}</div>`;
  }

  scanLoopId = requestAnimationFrame(scanFrame);
}

async function openScannerModal() {
  saleScannerMsg.innerHTML = "";
  saleScannerModal.classList.remove("hidden");

  barcodeDetector = await initDetector();
  if (!barcodeDetector) {
    saleScannerHint.textContent = tr("Camera scanning is not supported in this browser. You can still type barcode manually or use a USB scanner.");
    saleScannerMsg.innerHTML = `<div class="msg error">${tr("BarcodeDetector is not available.")}</div>`;
    return;
  }

  saleScannerHint.textContent = tr("Point your camera at a barcode to auto-fill sale barcode field.");

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    saleScannerVideo.srcObject = scannerStream;
    await saleScannerVideo.play();
    scanLoopId = requestAnimationFrame(scanFrame);
  } catch (error) {
    saleScannerMsg.innerHTML = `<div class="msg error">Camera access failed: ${error.message}</div>`;
  }
}

closeSaleModal.addEventListener("click", closeModal);
saleModal.addEventListener("click", (e) => {
  if (e.target === saleModal) closeModal();
});

async function loadSales() {
  listMsg.innerHTML = "";
  try {
    const res = await App.apiFetch("/sales?limit=20");
    salesBody.innerHTML = (res.data || []).map((s) => `
      <tr>
        <td>${s.sale_id}</td>
        <td>${new Date(s.sale_datetime).toLocaleString()}</td>
        <td>${s.grand_total}</td>
        <td>${s.payment_status}</td>
        <td>${s.sold_by_name}</td>
        <td>
          <button data-view="${s.sale_id}" class="secondary btn-inline">${tr("Detail")}</button>
          ${App.isAdmin() ? `<button data-void="${s.sale_id}" class="danger btn-inline ml-6">${tr("Void")}</button>` : ""}
        </td>
      </tr>
    `).join("");
  } catch (error) {
    listMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

salesBody.addEventListener("click", async (e) => {
  const viewId = e.target.getAttribute("data-view");
  const voidId = e.target.getAttribute("data-void");

  if (viewId) {
    try {
      const res = await App.apiFetch(`/sales/${viewId}`);
      const sale = res.data;
      const itemsRows = (sale.items || []).map((x) => `<tr><td>${escapeHtml(x.product_name)}</td><td>${x.quantity_sold}</td><td>${x.unit_price}</td><td>${x.line_total}</td></tr>`).join("");
      const paymentRows = (sale.payments || []).map((x) => `<tr><td>${x.payment_method}</td><td>${x.amount}</td><td>${new Date(x.paid_at).toLocaleString()}</td></tr>`).join("");

      openSaleModal(`
        <p><strong>${tr("Sale ID")}:</strong> ${sale.sale_id}</p>
        <p><strong>${tr("Date")}:</strong> ${new Date(sale.sale_datetime).toLocaleString()}</p>
        <p><strong>${tr("Status")}:</strong> ${sale.payment_status}</p>
        <p><strong>${tr("Total")}:</strong> ${sale.grand_total}</p>
        <h4 class="mt-16">${tr("Items")}</h4>
        <div class="table-wrap">
          <table><thead><tr><th>${tr("Product")}</th><th>${tr("Qty")}</th><th>${tr("Unit Price")}</th><th>${tr("Line Total")}</th></tr></thead><tbody>${itemsRows || `<tr><td colspan='4'>${tr("No items")}</td></tr>`}</tbody></table>
        </div>
        <h4 class="mt-16">${tr("Payments")}</h4>
        <div class="table-wrap">
          <table><thead><tr><th>${tr("Method")}</th><th>${tr("Amount")}</th><th>${tr("Paid At")}</th></tr></thead><tbody>${paymentRows || `<tr><td colspan='3'>${tr("No payments")}</td></tr>`}</tbody></table>
        </div>
      `);
    } catch (error) {
      listMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
    }
  }

  if (voidId) {
    if (!confirm(`${tr("Void sale")} #${voidId}?`)) return;
    try {
      await App.apiFetch(`/sales/${voidId}/void`, { method: "POST" });
      loadSales();
    } catch (error) {
      listMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
    }
  }
});

document.getElementById("saleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  saleMsg.innerHTML = "";

  try {
    const product = selectedProduct || await findProductByBarcode();
    if (!product) return;

    const qty = Number(qtyInput.value);
    const payMethod = payMethodInput.value;
    const paidAmount = Number(paidAmountInput.value);

    await App.apiFetch("/sales", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            product_id: product.product_id,
            quantity_sold: qty,
            unit_price: Number(product.selling_price),
            discount_amount: 0
          }
        ],
        payments: [
          {
            payment_method: payMethod,
            amount: paidAmount
          }
        ]
      })
    });

    saleMsg.innerHTML = `<div class="msg ok">${tr("Sale created successfully.")}</div>`;
    e.target.reset();
    selectedProduct = null;
    setProductPreview(null);
    loadSales();
  } catch (error) {
    saleMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

findSaleProductBtn.addEventListener("click", findProductByBarcode);
qtyInput.addEventListener("input", () => {
  if (selectedProduct) setProductPreview(selectedProduct);
});
barcodeInput.addEventListener("change", () => {
  selectedProduct = null;
  setProductPreview(null);
});

scanSaleBtn.addEventListener("click", openScannerModal);
closeSaleScannerBtn.addEventListener("click", closeScannerModal);
saleScannerModal.addEventListener("click", (e) => {
  if (e.target === saleScannerModal) closeScannerModal();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopScanner();
});

loadSales();
