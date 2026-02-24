App.requireAuth();
App.renderNav("users");
const tr = App.t;

if (!App.hasPermission("users.manage")) {
  document.body.innerHTML = `<div class="container"><div class="msg error">${tr("You do not have permission to access user management.")}</div></div>`;
}

const usersBody = document.getElementById("usersBody");
const formMsg = document.getElementById("formMsg");
const tableMsg = document.getElementById("tableMsg");
const rolesMsg = document.getElementById("rolesMsg");
const roleSelect = document.getElementById("role_id");
const rolesList = document.getElementById("rolesList");
const canManageRoles = App.hasPermission("roles.manage");

const editUserModal = document.getElementById("editUserModal");
const closeEditModalBtn = document.getElementById("closeEditModal");
const editUserForm = document.getElementById("editUserForm");
const editFormMsg = document.getElementById("editFormMsg");
const editUserIdInput = document.getElementById("edit_user_id");
const editFullNameInput = document.getElementById("edit_full_name");
const editEmailInput = document.getElementById("edit_email");
const editRoleIdSelect = document.getElementById("edit_role_id");
const editIsActiveSelect = document.getElementById("edit_is_active");
const editNewPasswordInput = document.getElementById("edit_new_password");

let roles = [];
let permissions = [];
let usersCache = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setMsg(target, type, text) {
  target.innerHTML = `<div class="msg ${type}">${escapeHtml(text)}</div>`;
}

function roleOptionsHtml(selectedRoleId) {
  return roles
    .filter((r) => r.is_active === 1)
    .map((r) => `<option value="${r.role_id}" ${Number(selectedRoleId) === Number(r.role_id) ? "selected" : ""}>${escapeHtml(r.role_name)} (${escapeHtml(r.role_code)})</option>`)
    .join("");
}

function renderRoleSelectOptions() {
  roleSelect.innerHTML = roleOptionsHtml();
  editRoleIdSelect.innerHTML = roleOptionsHtml();
}

function roleLabelById(roleId) {
  const role = roles.find((r) => Number(r.role_id) === Number(roleId));
  if (!role) return "-";
  return `${role.role_name} (${role.role_code})`;
}

function renderRolesList() {
  if (roles.length === 0) {
    rolesList.innerHTML = `<div class='msg error'>${tr("No system roles found")}</div>`;
    return;
  }

  rolesList.innerHTML = roles
    .map((role) => {
      const rolePermKeys = new Set((role.permissions || []).map((p) => p.permission_key));
      const permissionItems = permissions
        .map((p) => `
          <label class="permission-item">
            <input type="checkbox" data-role-perm="${role.role_id}" value="${escapeHtml(p.permission_key)}" ${rolePermKeys.has(p.permission_key) ? "checked" : ""} ${!canManageRoles ? "disabled" : ""} />
            <span>${escapeHtml(p.permission_name)}</span>
          </label>
        `)
        .join("");

      return `
        <article class="role-card" data-role-card="${role.role_id}">
          <div class="row">
            <div>
              <label>Role Code</label>
              <input value="${escapeHtml(role.role_code)}" disabled />
            </div>
            <div>
              <label>${tr("Role Name")}</label>
              <input value="${escapeHtml(role.role_name)}" disabled />
            </div>
          </div>

          <div class="mt-8">
            <label>${tr("Permissions")}</label>
            <div class="permission-grid">${permissionItems}</div>
          </div>

          <div class="row mt-12">
            <div>${canManageRoles ? `<button type="button" class="secondary" data-role-save="${role.role_id}">${tr("Save Permissions")}</button>` : ""}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function getCheckedPermissions(containerSelector) {
  return Array.from(document.querySelectorAll(containerSelector))
    .filter((el) => el.checked)
    .map((el) => el.value);
}

function openEditModal(userId) {
  const user = usersCache.find((u) => Number(u.user_id) === Number(userId));
  if (!user) {
    setMsg(tableMsg, "error", tr("User not found in current list."));
    return;
  }

  editFormMsg.innerHTML = "";
  editUserIdInput.value = String(user.user_id);
  editFullNameInput.value = user.full_name || "";
  editEmailInput.value = user.email || "";
  editRoleIdSelect.innerHTML = roleOptionsHtml(user.role_id);
  editIsActiveSelect.value = String(Number(user.is_active || 0));
  editNewPasswordInput.value = "";

  editUserModal.classList.remove("hidden");
}

function closeEditModal() {
  editUserModal.classList.add("hidden");
  editFormMsg.innerHTML = "";
  editUserForm.reset();
}

async function loadRolesAndPermissions() {
  try {
    const [rolesRes, permsRes] = await Promise.all([
      App.apiFetch("/roles"),
      App.apiFetch("/roles/permissions")
    ]);

    const allRoles = rolesRes.data || [];
    roles = allRoles.filter((r) => ["ADMIN", "STAFF"].includes(String(r.role_code || "").toUpperCase()));
    permissions = permsRes.data || [];

    renderRoleSelectOptions();
    renderRolesList();
  } catch (error) {
    setMsg(rolesMsg, "error", error.message);
  }
}

async function loadUsers() {
  tableMsg.innerHTML = "";
  const q = encodeURIComponent(document.getElementById("search").value || "");

  try {
    const res = await App.apiFetch(`/users?limit=100&q=${q}`);
    usersCache = res.data || [];

    usersBody.innerHTML = usersCache.map((u) => `
      <tr>
        <td>${u.user_id}</td>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(roleLabelById(u.role_id))}</td>
        <td>${Number(u.is_active) === 1 ? tr("Active") : tr("Inactive")}</td>
        <td>
          <button class="secondary btn-inline" data-edit="${u.user_id}">${tr("Edit")}</button>
          <button class="danger btn-inline ml-6" data-del="${u.user_id}">${tr("Delete")}</button>
        </td>
      </tr>
    `).join("");
  } catch (error) {
    setMsg(tableMsg, "error", error.message);
  }
}

document.getElementById("btnLoad").addEventListener("click", loadUsers);

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.innerHTML = "";

  try {
    await App.apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        full_name: document.getElementById("full_name").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        role_id: Number(document.getElementById("role_id").value)
      })
    });

    setMsg(formMsg, "ok", tr("User created."));
    e.target.reset();
    await loadUsers();
  } catch (error) {
    setMsg(formMsg, "error", error.message);
  }
});

usersBody.addEventListener("click", async (e) => {
  const editId = e.target.getAttribute("data-edit");
  const delId = e.target.getAttribute("data-del");

  if (editId) {
    openEditModal(editId);
  }

  if (delId) {
    if (!confirm(`${tr("Delete user")} #${delId}?`)) return;

    try {
      await App.apiFetch(`/users/${delId}`, { method: "DELETE" });
      setMsg(tableMsg, "ok", tr("User deleted."));
      await loadUsers();
    } catch (error) {
      setMsg(tableMsg, "error", error.message);
    }
  }
});

editUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editFormMsg.innerHTML = "";

  const userId = Number(editUserIdInput.value);
  const currentUser = usersCache.find((u) => Number(u.user_id) === userId);
  const payload = {};

  const fullName = editFullNameInput.value.trim();
  const email = editEmailInput.value.trim();
  const roleId = Number(editRoleIdSelect.value);
  const isActive = Number(editIsActiveSelect.value);

  if (fullName && fullName !== (currentUser?.full_name || "")) {
    payload.full_name = fullName;
  }
  if (email && email !== (currentUser?.email || "")) {
    payload.email = email;
  }
  if (Number.isFinite(roleId) && roleId > 0 && roleId !== Number(currentUser?.role_id)) {
    payload.role_id = roleId;
  }
  if ((isActive === 0 || isActive === 1) && isActive !== Number(currentUser?.is_active)) {
    payload.is_active = isActive;
  }

  const newPassword = editNewPasswordInput.value.trim();
  if (newPassword) payload.new_password = newPassword;

  if (Object.keys(payload).length === 0) {
    setMsg(editFormMsg, "error", tr("No changes to update."));
    return;
  }

  try {
    await App.apiFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    setMsg(tableMsg, "ok", tr("User updated."));
    closeEditModal();
    await loadUsers();
  } catch (error) {
    setMsg(editFormMsg, "error", error.message);
  }
});

closeEditModalBtn.addEventListener("click", closeEditModal);
editUserModal.addEventListener("click", (e) => {
  if (e.target === editUserModal) closeEditModal();
});

rolesList.addEventListener("click", async (e) => {
  const roleSaveId = e.target.getAttribute("data-role-save");
  if (!roleSaveId) return;

  try {
    const rolePermissionKeys = getCheckedPermissions(`input[data-role-perm='${roleSaveId}']`);

    await App.apiFetch(`/roles/${roleSaveId}`, {
      method: "PATCH",
      body: JSON.stringify({ permission_keys: rolePermissionKeys })
    });

    setMsg(rolesMsg, "ok", tr("Role permissions updated."));
    await loadRolesAndPermissions();
  } catch (error) {
    setMsg(rolesMsg, "error", error.message);
  }
});

(async function bootstrap() {
  await loadRolesAndPermissions();
  await loadUsers();
})();
