import React from "react";
import { useEffect, useState } from "react";
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
  ["/notifications", "Notifications"],
  ["/categories", "Categories"],
  ["/users", "Users"],
  ["/email-settings", "Email Settings"]
];

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const user = getUser();
  const lang = getLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("has-app-nav");
    document.documentElement.setAttribute("lang", lang === "km" ? "km" : "en");
    document.body.classList.toggle("sidebar-open", sidebarOpen);
    return () => {
      document.body.classList.remove("has-app-nav");
      document.body.classList.remove("sidebar-open");
    };
  }, [lang, sidebarOpen]);

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
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setSidebarOpen(false)}
            >
              {t(label)}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.full_name || t("User")}</div>
            <div className="sidebar-user-role">{user?.role || t("STAFF")}</div>
          </div>
          <button type="button" className="secondary" onClick={logout}>{t("Logout")}</button>
        </div>
      </aside>

      <header className="app-topbar">
        <button
          id="navToggle"
          className="nav-toggle btn-inline"
          type="button"
          aria-label={t("Menu")}
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          {t("Menu")}
        </button>
        <div className="topbar-title">{t(title)}</div>
        <div className="lang-switch">
          <button type="button" className={`btn-inline ${lang === "en" ? "active" : ""}`} onClick={() => switchLang("en")}>EN</button>
          <button type="button" className={`btn-inline ${lang === "km" ? "active" : ""}`} onClick={() => switchLang("km")}>ខ្មែរ</button>
        </div>
      </header>

      <div className="app-overlay" onClick={() => setSidebarOpen(false)} />

      <main className="container layout">{children}</main>
    </>
  );
}
