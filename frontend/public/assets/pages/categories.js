App.requireAuth();
App.renderNav("categories");
const tr = App.t;

const form = document.getElementById("categoryForm");
const formMsg = document.getElementById("formMsg");
const tableMsg = document.getElementById("tableMsg");
const body = document.getElementById("categoriesBody");
const saveBtn = document.getElementById("saveBtn");

let editingId = null;

if (!App.isAdmin()) {
  form.innerHTML = `<div class="msg error">${tr("Only ADMIN can manage categories.")}</div>`;
  saveBtn?.setAttribute("disabled", "disabled");
}

function resetForm() {
  editingId = null;
  form.reset();
  saveBtn.textContent = tr("Save Category");
}

async function loadCategories() {
  tableMsg.innerHTML = "";
  const q = encodeURIComponent(document.getElementById("search").value || "");
  try {
    const res = await App.apiFetch(`/categories?limit=100&q=${q}`);
    body.innerHTML = (res.data || []).map((c) => `
      <tr>
        <td>${c.category_id}</td>
        <td>${c.category_name}</td>
        <td>${c.description || "-"}</td>
        <td>${c.is_active === 1 ? tr("Active") : tr("Inactive")}</td>
        <td>
          ${App.isAdmin() ? `<button data-edit="${c.category_id}" class="secondary btn-inline">${tr("Edit")}</button>
          <button data-del="${c.category_id}" class="danger btn-inline ml-6">${tr("Delete")}</button>` : "-"}
        </td>
      </tr>
    `).join("");
  } catch (error) {
    tableMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
}

document.getElementById("btnLoad").addEventListener("click", loadCategories);

body.addEventListener("click", async (e) => {
  const editId = e.target.getAttribute("data-edit");
  const delId = e.target.getAttribute("data-del");

  if (editId) {
    try {
      const res = await App.apiFetch(`/categories/${editId}`);
      const category = res.data;
      document.getElementById("category_name").value = category.category_name || "";
      document.getElementById("description").value = category.description || "";
      editingId = Number(editId);
      saveBtn.textContent = tr("Update Category");
    } catch (error) {
      formMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
    }
  }

  if (delId) {
    if (!confirm(`${tr("Delete category")} #${delId}?`)) return;
    try {
      await App.apiFetch(`/categories/${delId}`, { method: "DELETE" });
      if (editingId === Number(delId)) resetForm();
      loadCategories();
    } catch (error) {
      tableMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.innerHTML = "";

  if (!App.isAdmin()) {
    formMsg.innerHTML = `<div class="msg error">${tr("Only ADMIN can save categories.")}</div>`;
    return;
  }

  const payload = {
    category_name: document.getElementById("category_name").value,
    description: document.getElementById("description").value || null
  };

  try {
    if (editingId) {
      await App.apiFetch(`/categories/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      formMsg.innerHTML = `<div class="msg ok">${tr("Category updated.")}</div>`;
    } else {
      await App.apiFetch("/categories", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      formMsg.innerHTML = `<div class="msg ok">${tr("Category created.")}</div>`;
    }

    resetForm();
    loadCategories();
  } catch (error) {
    formMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

loadCategories();
