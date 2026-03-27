import React from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch, clearAuth, getUser } from "../lib/api";
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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState({ unread_count: 0, recent: [] });
  const notificationRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("has-app-nav");
    document.documentElement.setAttribute("lang", lang === "km" ? "km" : "en");
    document.body.classList.toggle("sidebar-open", sidebarOpen);
    return () => {
      document.body.classList.remove("has-app-nav");
      document.body.classList.remove("sidebar-open");
    };
  }, [lang, sidebarOpen]);

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      try {
        const res = await apiFetch("/notifications/summary");
        if (mounted) setNotificationSummary(res?.data || { unread_count: 0, recent: [] });
      } catch {
        if (mounted) setNotificationSummary({ unread_count: 0, recent: [] });
      }
    };

    loadSummary();
    const timer = window.setInterval(loadSummary, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event) => {
      if (!notificationRef.current?.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const switchLang = (next) => {
    if (next === lang) return;
    setLanguage(next);
    window.location.reload();
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setNotificationSummary((prev) => ({
        unread_count: 0,
        recent: prev.recent.map((item) => ({ ...item, read: true }))
      }));
    } catch {
      // no-op: summary refresh will recover on next poll
    }
  };

  const openNotification = async (item) => {
    try {
      if (item?.id && !item.read) {
        await apiFetch(`/notifications/${item.id}/read`, { method: "PATCH" });
        setNotificationSummary((prev) => ({
          unread_count: Math.max(0, Number(prev.unread_count || 0) - 1),
          recent: prev.recent.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry))
        }));
      }
    } catch {
      // no-op
    }

    setNotificationOpen(false);
    navigate(item?.source_link || "/notifications");
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
        <div className="notification-shell" ref={notificationRef}>
          <button
            type="button"
            className={`btn-inline notification-bell ${notificationOpen ? "active" : ""}`}
            onClick={() => setNotificationOpen((prev) => !prev)}
            aria-label={t("Notifications")}
          >
            <span className="notification-bell-icon">🔔</span>
            {notificationSummary.unread_count ? (
              <span className="notification-count">{notificationSummary.unread_count}</span>
            ) : null}
          </button>
          {notificationOpen ? (
            <div className="notification-dropdown">
              <div className="notification-dropdown-head">
                <strong>{t("Notification Center")}</strong>
                <button type="button" className="btn-inline secondary" onClick={markAllNotificationsRead}>
                  {t("Mark All Read")}
                </button>
              </div>
              <div className="notification-dropdown-list">
                {notificationSummary.recent?.length ? notificationSummary.recent.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`notification-item ${item.read ? "read" : "unread"}`}
                    onClick={() => openNotification(item)}
                  >
                    <div className="notification-item-head">
                      <span>{t(item.type || "Notifications")}</span>
                      <span>{item.time || "-"}</span>
                    </div>
                    <strong>{item.product || "-"}</strong>
                    <span>{item.message || "-"}</span>
                  </button>
                )) : (
                  <div className="notification-empty">{t("No notifications")}</div>
                )}
              </div>
              <button
                type="button"
                className="btn-inline secondary notification-view-all"
                onClick={() => {
                  setNotificationOpen(false);
                  navigate("/notifications");
                }}
              >
                {t("View All Notifications")}
              </button>
            </div>
          ) : null}
        </div>
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
