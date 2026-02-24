App.requireAuth();
App.renderNav("products");
const tr = App.t;

const body = document.getElementById("productsBody");
const formMsg = document.getElementById("formMsg");
const tableMsg = document.getElementById("tableMsg");
const categorySelect = document.getElementById("category_id");
const categoryHint = document.getElementById("categoryHint");
const barcodeInput = document.getElementById("barcode");

const stockForm = document.getElementById("stockUpdateForm");
const stockMsg = document.getElementById("stockMsg");
const stockBarcodeInput = document.getElementById("stock_barcode");
const findStockProductBtn = document.getElementById("findStockProductBtn");
const scanStockBtn = document.getElementById("scanStockBtn");
const stockProductPreview = document.getElementById("stockProductPreview");
const adjustmentTypeInput = document.getElementById("adjustment_type");
const adjustmentQuantityInput = document.getElementById("adjustment_quantity");
const adjustmentReasonInput = document.getElementById("adjustment_reason");

const scannerModal = document.getElementById("scannerModal");
const openScannerBtn = document.getElementById("openScannerBtn");
const closeScannerBtn = document.getElementById("closeScannerBtn");
const scannerVideo = document.getElementById("scannerVideo");
const scannerMsg = document.getElementById("scannerMsg");
const scannerHint = document.getElementById("scannerHint");

let categoriesLoaded = 0;
let scannerStream = null;
let scanLoopId = null;
let barcodeDetector = null;
let scanTargetInput = barcodeInput;
let selectedStockProduct = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStockPreview(product) {
  if (!product) {
    stockProductPreview.classList.add("hidden");
    stockProductPreview.innerHTML = "";
    return;
  }

  stockProductPreview.classList.remove("hidden");
  stockProductPreview.innerHTML = `
    <div><strong>${escapeHtml(product.product_name)}</strong></div>
    <div>${tr("Barcode")}: ${escapeHtml(product.barcode)}</div>
    <div>${tr("Category")}: ${escapeHtml(product.category_name || product.category_id)}</div>
    <div>${tr("Current Stock")}: <strong>${product.quantity}</strong></div>
  `;
}

async function loadCategories() {
  try {
    const res = await App.apiFetch("/categories?limit=200&is_active=1");
    const categories = res.data || [];
    categoriesLoaded = categories.length;

    const options = categories
      .map((c) => `<option value="${c.category_id}">${c.category_name}</option>`)
      .join("");

    if (!options) {
      categorySelect.innerHTML = `<option value=''>${tr("No categories yet")}</option>`;
      categoryHint.innerHTML = App.isAdmin()
        ? `<div class="msg error">${tr("No category found. Create one first:")} <button id="quickCreateCategory" type="button" class="btn-inline">${tr("Create Category")}</button></div>`
        : `<div class="msg error">${tr("No category found. Please ask Admin to create categories first.")}</div>`;

      if (App.isAdmin()) {
        document.getElementById("quickCreateCategory")?.addEventListener("click", async () => {
          const name = prompt(tr("Enter category name:"));
          if (!name) return;
          try {
            await App.apiFetch("/categories", {
              method: "POST",
              body: JSON.stringify({ category_name: name, description: null })
            });
            await loadCategories();
          } catch (error) {
            formMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
          }
        });
      }
      return;
    }

    categoryHint.innerHTML = "";
    categorySelect.innerHTML = options;
  } catch (error) {
    categoriesLoaded = 0;
    categorySelect.innerHTML = `<option value=''>${tr("Failed to load categories")}</option>`;
    categoryHint.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

async function loadProducts() {
  tableMsg.innerHTML = "";
  const q = encodeURIComponent(document.getElementById("search").value || "");
  try {
    const res = await App.apiFetch(`/products?limit=50&q=${q}`);
    body.innerHTML = (res.data || []).map((p) => `
      <tr>
        <td>${p.product_id}</td>
        <td>${escapeHtml(p.product_name)}</td>
        <td>${escapeHtml(p.barcode)}</td>
        <td>${escapeHtml(p.category_name || p.category_id)}</td>
        <td>${p.quantity}</td>
        <td>${p.selling_price}</td>
        <td>
          ${App.isAdmin() ? `<button data-del="${p.product_id}" class="danger btn-inline">${tr("Delete")}</button>` : "-"}
        </td>
      </tr>
    `).join("");
  } catch (error) {
    tableMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
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

  scannerVideo.srcObject = null;
}

function closeScannerModal() {
  stopScanner();
  scannerModal.classList.add("hidden");
  scannerMsg.innerHTML = "";
}

async function scanFrame() {
  if (!barcodeDetector || !scannerVideo || scannerVideo.readyState < 2) {
    scanLoopId = requestAnimationFrame(scanFrame);
    return;
  }

  try {
    const codes = await barcodeDetector.detect(scannerVideo);
    if (codes.length > 0 && codes[0].rawValue) {
      scanTargetInput.value = codes[0].rawValue;
      scannerMsg.innerHTML = `<div class="msg ok">${tr("Barcode detected and filled.")}</div>`;
      setTimeout(async () => {
        closeScannerModal();
        if (scanTargetInput === stockBarcodeInput) {
          await findProductForStockUpdate();
        }
      }, 250);
      return;
    }
  } catch {
    scannerMsg.innerHTML = `<div class="msg error">${tr("Scanner failed to read. Try better lighting.")}</div>`;
  }

  scanLoopId = requestAnimationFrame(scanFrame);
}

async function openScannerModal(targetInput) {
  scanTargetInput = targetInput;
  scannerMsg.innerHTML = "";
  scannerModal.classList.remove("hidden");

  barcodeDetector = await initDetector();
  if (!barcodeDetector) {
    scannerHint.textContent = tr("Camera scanning is not supported in this browser. You can still type barcode manually or use a USB scanner.");
    scannerMsg.innerHTML = `<div class="msg error">${tr("BarcodeDetector is not available.")}</div>`;
    return;
  }

  scannerHint.textContent = tr("Point your camera at a barcode to auto-fill the selected field.");

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();
    scanLoopId = requestAnimationFrame(scanFrame);
  } catch (error) {
    scannerMsg.innerHTML = `<div class="msg error">Camera access failed: ${error.message}</div>`;
  }
}

async function findProductForStockUpdate() {
  stockMsg.innerHTML = "";
  const barcode = stockBarcodeInput.value.trim();

  if (!barcode) {
    setStockPreview(null);
    stockMsg.innerHTML = `<div class="msg error">${tr("Please enter or scan barcode first.")}</div>`;
    return;
  }

  try {
    const res = await App.apiFetch(`/products/by-barcode/${encodeURIComponent(barcode)}`);
    selectedStockProduct = res.data;
    setStockPreview(selectedStockProduct);
    stockMsg.innerHTML = `<div class="msg ok">${tr("Product found. Ready to update stock.")}</div>`;
  } catch (error) {
    selectedStockProduct = null;
    setStockPreview(null);
    stockMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

document.getElementById("btnLoad").addEventListener("click", loadProducts);

body.addEventListener("click", async (e) => {
  const id = e.target.getAttribute("data-del");
  if (!id) return;

  if (!confirm(`${tr("Delete product")} #${id}?`)) return;
  try {
    await App.apiFetch(`/products/${id}`, { method: "DELETE" });
    loadProducts();
  } catch (error) {
    tableMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.innerHTML = "";
  if (categoriesLoaded === 0) {
    formMsg.innerHTML = `<div class="msg error">${tr("Please create at least one category before saving a product.")}</div>`;
    return;
  }
  try {
    await App.apiFetch("/products", {
      method: "POST",
      body: JSON.stringify({
        product_name: document.getElementById("product_name").value,
        barcode: document.getElementById("barcode").value,
        category_id: Number(document.getElementById("category_id").value),
        quantity: Number(document.getElementById("quantity").value),
        min_stock_level: 5,
        cost_price: Number(document.getElementById("cost_price").value),
        selling_price: Number(document.getElementById("selling_price").value)
      })
    });
    formMsg.innerHTML = `<div class="msg ok">${tr("Product created.")}</div>`;
    e.target.reset();
    await loadCategories();
    loadProducts();
  } catch (error) {
    formMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

stockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  stockMsg.innerHTML = "";

  if (!selectedStockProduct) {
    stockMsg.innerHTML = `<div class="msg error">${tr("Please find a valid product by barcode first.")}</div>`;
    return;
  }

  try {
    await App.apiFetch(`/products/${selectedStockProduct.product_id}/stock-adjustment`, {
      method: "PATCH",
      body: JSON.stringify({
        adjustment_type: adjustmentTypeInput.value,
        quantity: Number(adjustmentQuantityInput.value),
        reason: adjustmentReasonInput.value.trim()
      })
    });

    stockMsg.innerHTML = `<div class="msg ok">${tr("Stock updated successfully.")}</div>`;
    const usedBarcode = stockBarcodeInput.value;
    stockForm.reset();
    stockBarcodeInput.value = usedBarcode;
    adjustmentTypeInput.value = "ADJUSTMENT_IN";
    adjustmentQuantityInput.value = "1";
    await findProductForStockUpdate();
    await loadProducts();
  } catch (error) {
    stockMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

findStockProductBtn.addEventListener("click", findProductForStockUpdate);
stockBarcodeInput.addEventListener("change", () => {
  selectedStockProduct = null;
  setStockPreview(null);
});

openScannerBtn.addEventListener("click", () => openScannerModal(barcodeInput));
scanStockBtn.addEventListener("click", () => openScannerModal(stockBarcodeInput));
closeScannerBtn.addEventListener("click", closeScannerModal);
scannerModal.addEventListener("click", (e) => {
  if (e.target === scannerModal) closeScannerModal();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopScanner();
});

if (!App.isAdmin()) {
  stockForm.classList.add("hidden");
  stockMsg.innerHTML = `<div class="msg error">${tr("Only ADMIN can adjust stock quantities.")}</div>`;
}

loadCategories();
loadProducts();
