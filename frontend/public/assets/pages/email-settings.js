App.requireAuth();
App.renderNav("email");
const tr = App.t;

if (!App.isAdmin()) {
  document.body.innerHTML = `<div class="container"><div class="msg error">${tr("Only ADMIN can access Email Settings.")}</div></div>`;
}

function setForm(data) {
  if (!data) return;
  document.getElementById("smtp_host").value = data.smtp_host || "";
  document.getElementById("smtp_port").value = data.smtp_port || 587;
  document.getElementById("smtp_user").value = data.smtp_user || "";
  document.getElementById("sender_name").value = data.sender_name || "";
  document.getElementById("sender_email").value = data.sender_email || "";
  document.getElementById("use_tls").value = data.use_tls ?? 1;
  document.getElementById("alert_expiry_days").value = data.alert_expiry_days ?? 7;
  document.getElementById("alert_low_stock_enabled").value = data.alert_low_stock_enabled ?? 1;
  document.getElementById("alert_expiry_enabled").value = data.alert_expiry_enabled ?? 1;
}

async function loadSettings() {
  try {
    const res = await App.apiFetch("/email-settings");
    setForm(res.data);
  } catch {}
}

document.getElementById("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.innerHTML = "";

  try {
    const payload = {
      smtp_host: document.getElementById("smtp_host").value,
      smtp_port: Number(document.getElementById("smtp_port").value),
      smtp_user: document.getElementById("smtp_user").value,
      smtp_password: document.getElementById("smtp_password").value,
      sender_name: document.getElementById("sender_name").value,
      sender_email: document.getElementById("sender_email").value,
      use_tls: Number(document.getElementById("use_tls").value),
      alert_expiry_days: Number(document.getElementById("alert_expiry_days").value),
      alert_low_stock_enabled: Number(document.getElementById("alert_low_stock_enabled").value),
      alert_expiry_enabled: Number(document.getElementById("alert_expiry_enabled").value)
    };

    await App.apiFetch("/email-settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    msg.innerHTML = `<div class="msg ok">${tr("Email settings saved.")}</div>`;
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

document.getElementById("testBtn").addEventListener("click", async () => {
  const testMsg = document.getElementById("testMsg");
  testMsg.innerHTML = "";
  try {
    const toEmail = document.getElementById("to_email").value;
    const res = await App.apiFetch("/email-settings/test", {
      method: "POST",
      body: JSON.stringify({ to_email: toEmail || undefined })
    });
    testMsg.innerHTML = `<div class="msg ok">${tr("Test sent. Message ID:")} ${res.data.message_id || "n/a"}</div>`;
  } catch (error) {
    testMsg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});

loadSettings();
