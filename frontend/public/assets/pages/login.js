const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

async function handleExistingSession() {
  if (!localStorage.getItem("token")) return;

  try {
    await App.apiFetch("/auth/me");
    location.href = "/dashboard.html";
  } catch {
    App.clearAuth();
  }
}

handleExistingSession();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.innerHTML = "";

  try {
    const res = await App.apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
      })
    });

    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    location.href = "/dashboard.html";
  } catch (error) {
    msg.innerHTML = `<div class="msg error">${error.message}</div>`;
  }
});
