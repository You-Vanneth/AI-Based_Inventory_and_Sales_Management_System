import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getToken } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import SalesPage from "./pages/SalesPage";
import ReportsPage from "./pages/ReportsPage";
import AIPage from "./pages/AIPage";
import InventoryHealthPage from "./pages/InventoryHealthPage";
import CategoriesPage from "./pages/CategoriesPage";
import UsersPage from "./pages/UsersPage";
import EmailSettingsPage from "./pages/EmailSettingsPage";

function PrivateRoute({ children }) {
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><ProductsPage /></PrivateRoute>} />
      <Route path="/sales" element={<PrivateRoute><SalesPage /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
      <Route path="/ai" element={<PrivateRoute><AIPage /></PrivateRoute>} />
      <Route path="/inventory-health" element={<PrivateRoute><InventoryHealthPage /></PrivateRoute>} />
      <Route path="/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
      <Route path="/email-settings" element={<PrivateRoute><EmailSettingsPage /></PrivateRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
