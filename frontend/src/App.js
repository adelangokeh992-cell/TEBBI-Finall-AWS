import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import BillingPage from "./pages/BillingPage";
import AccountingPage from "./pages/AccountingPage";
import CompanyAdminDashboard from "./pages/CompanyAdminDashboard";
import ClinicManagementPage from "./pages/ClinicManagementPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import PublicBookingPage from "./pages/PublicBookingPage";
import HomePage from "./pages/HomePage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import DoctorProfilePage from "./pages/DoctorProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MfaSetupPage from "./pages/MfaSetupPage";
import MfaChallengePage from "./pages/MfaChallengePage";
import PortalPage from "./pages/PortalPage";
import TelemedicineRoomPage from "./pages/TelemedicineRoomPage";
import QueuePage from "./pages/QueuePage";
import PharmacyPage from "./pages/PharmacyPage";
import ConsentFormsPage from "./pages/ConsentFormsPage";
import MarketingPage from "./pages/MarketingPage";
import AuditLogsPage from "./pages/AuditLogsPage";

// Super Admin Pages
import SuperAdminLayout from "./components/SuperAdminLayout";
import SuperAdminOverview from "./pages/superadmin/Overview";
import ClinicsPage from "./pages/superadmin/ClinicsPage";
import ClinicDetailPage from "./pages/superadmin/ClinicDetailPage";
import DoctorsPage from "./pages/superadmin/DoctorsPage";
import SubscriptionsPage from "./pages/superadmin/SubscriptionsPage";
import PermissionsPage from "./pages/superadmin/PermissionsPage";
import BackupPage from "./pages/superadmin/BackupPage";
import AdminSettingsPage from "./pages/superadmin/SettingsPage";

// Layout
import Layout from "./components/Layout";
import { LoadingSpinner } from "./components/common";

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner className="min-h-screen bg-slate-50 dark:bg-slate-950" size="lg" />;
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Public Route wrapper (redirects based on role if logged in)
const PublicRoute = ({ children }) => {
  const { token, loading, user, getRedirectPath } = useAuth();
  
  if (loading) {
    return <LoadingSpinner className="min-h-screen bg-slate-50 dark:bg-slate-950" size="lg" />;
  }
  
  if (token) {
    const redirectPath = getRedirectPath(user);
    return <Navigate to={redirectPath} replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Home Page */}
      <Route path="/" element={<HomePage />} />

      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/mfa-setup" element={<MfaSetupPage />} />
      <Route path="/mfa-challenge" element={<MfaChallengePage />} />

      {/* Public Online Booking Page - all clinics or single clinic by code */}
      <Route path="/booking" element={<PublicBookingPage />} />
      <Route path="/booking/:clinicCode" element={<PublicBookingPage />} />
      
      {/* Doctor Profile Page (Public) */}
      <Route path="/dr/:identifier" element={<DoctorProfilePage />} />
      <Route path="/doctor/:identifier" element={<DoctorProfilePage />} />

      {/* Patient Portal (public entry with ?token=; after login uses portal JWT) */}
      <Route path="/portal" element={<PortalPage />} />

      {/* Super Admin Routes */}
      <Route path="/super-admin" element={<SuperAdminLayout />}>
        <Route index element={<SuperAdminOverview />} />
        <Route path="clinics" element={<ClinicsPage />} />
        <Route path="clinics/:id" element={<ClinicDetailPage />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* Protected Routes with Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="inventory" element={<Navigate to="/pharmacy" replace />} />
        <Route path="pharmacy" element={<PharmacyPage />} />
        <Route path="consent" element={<ConsentFormsPage />} />
        <Route path="marketing" element={<MarketingPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="ai" element={<AIAssistantPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="clinic-admin" element={<CompanyAdminDashboard />} />
        <Route path="clinic/settings" element={<ClinicManagementPage />} />
        <Route path="settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="settings/change-password" element={<ChangePasswordPage />} />
        <Route path="settings" element={<CompanySettingsPage />} />
        <Route path="telemedicine/room/:roomId" element={<TelemedicineRoomPage />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
