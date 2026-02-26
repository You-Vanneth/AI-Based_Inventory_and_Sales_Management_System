import React from "react";
import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../lib/api";
import { getLanguage, setLanguage, t } from "../lib/i18n";

const links = [
  ["/dashboard", "Dashboard"],
  ["/products", "Products"],
  ["/sales", "Sales"],
  ["/reports", "Reports"],
  ["/ai", "AI Forecast"],
  ["/inventory-health", "Inventory Health"],
  ["/categories", "Categories"],
  ["/users", "Users"],
  ["/email-settings", "Email Settings"]
];

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const user = getUser();
  const lang = getLanguage();

  useEffect(() => {
    document.body.classList.add("has-app-nav");
    document.documentElement.setAttribute("lang", lang === "km" ? "km" : "en");
    return () => {
      document.body.classList.remove("has-app-nav");
      document.body.classList.remove("sidebar-open");
    };
  }, [lang]);

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const switchLang = (next) => {
    if (next === lang) return;
    setLanguage(next);
    window.location.reload();
  };

  return (
    <>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <strong>{t("AI Inventory")}</strong>
        </div>
        <div className="sidebar-links">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
              {t(label)}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.full_name || "User"}</div>
            <div className="sidebar-user-role">{user?.role || "STAFF"}</div>
          </div>
          <button type="button" className="secondary" onClick={logout}>{t("Logout")}</button>
        </div>
      </aside>

      <header className="app-topbar">
        <div className="topbar-title">{t(title)}</div>
        <div className="lang-switch">
          <button type="button" className={`btn-inline ${lang === "en" ? "active" : ""}`} onClick={() => switchLang("en")}>EN</button>
          <button type="button" className={`btn-inline ${lang === "km" ? "active" : ""}`} onClick={() => switchLang("km")}>ខ្មែរ</button>
        </div>
      </header>

      <main className="container layout">{children}</main>
    </>
  );
}
