import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setToken } from "../lib/api";
import { getLanguage, setLanguage, t } from "../lib/i18n";

const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "123456";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [msg, setMsg] = useState("");
  const lang = getLanguage();

  const loginDemo = () => {
    setToken("demo-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ full_name: "Demo Admin", role: "ADMIN", role_name: "ADMIN" })
    );
    navigate("/dashboard");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      setToken(res?.data?.token || "");
      if (res?.data?.user) localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        loginDemo();
        return;
      }
      setMsg(`${t("Login failed")}: ${err.message}`);
    }
  };

  const switchLang = (next) => {
    if (next === lang) return;
    setLanguage(next);
    window.location.reload();
  };

  return (
    <div className="login-wrap">
      <div className="login-shell">
        <section className="login-brand">
          <h1>{t("Smart Inventory Control")}</h1>
          <p>{t("React frontend for sales and stock management.")}</p>
          <p className="mt-12">{t("Demo login: admin@example.com / 123456")}</p>
          <div className="lang-switch mt-12">
            <button type="button" className={`btn-inline ${lang === "en" ? "active" : ""}`} onClick={() => switchLang("en")}>EN</button>
            <button type="button" className={`btn-inline ${lang === "km" ? "active" : ""}`} onClick={() => switchLang("km")}>ខ្មែរ</button>
          </div>
        </section>
        <section className="card login-card">
          <h2>{t("Sign In")}</h2>
          <form className="grid" onSubmit={onSubmit}>
            <div>
              <label>{t("Email")}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label>{t("Password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit">{t("Login")}</button>
          </form>
          {msg ? <div className="msg error">{msg}</div> : null}
        </section>
      </div>
    </div>
  );
}
