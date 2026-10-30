import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth } from './lib/auth';
import LoginPage from './pages/LoginPage';
import AdminApp from './pages/admin/AdminApp';
import CustomerApp from './pages/customer/CustomerApp';
import TechnicianApp from './pages/technician/TechnicianApp';
import './styles.css';

function ProtectedRoute({ role, children }: { role: string; children: React.ReactNode }) {
  const auth = getAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.role !== role) return <Navigate to={`/${auth.role}`} replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const auth = getAuth();
  if (!auth) return <Navigate to="/login" replace />;
  return <Navigate to={`/${auth.role}`} replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={
          <ProtectedRoute role="admin"><AdminApp /></ProtectedRoute>
        } />
        <Route path="/customer/*" element={
          <ProtectedRoute role="customer"><CustomerApp /></ProtectedRoute>
        } />
        <Route path="/technician/*" element={
          <ProtectedRoute role="technician"><TechnicianApp /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
