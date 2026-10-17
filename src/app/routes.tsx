import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { FocusShell, MerchantShell, SessionListener, ToastViewport } from "../components/shell";
import { isStandalone } from "../lib/install";
import { AttestationPage } from "../pages/attestation";
import { ForgotPage, InstallPage, LoginPage, RegisterPage } from "../pages/auth";
import { ChargePage } from "../pages/charge";
import { InvoicePage } from "../pages/invoice";
import { DashboardPage, SalesPage, ScorePage } from "../pages/lists";
import { BalancePage, PayoutConfirmPage, PayoutFormPage, PayoutStatusPage, SettingsPage, SystemPage } from "../pages/money";
import { PayPage } from "../pages/pay";
import { UniversalQrPage } from "../pages/qr";
import { useSession } from "../stores/session";

export function AppRoutes() {
  return (
    <>
      <SessionListener />
      <ToastViewport />
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<Gate />} />
        <Route path="/app/install" element={<InstallPage />} />
        <Route path="/app/register" element={<RegisterPage />} />
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/app/forgot" element={<ForgotPage />} />
        <Route element={<RequireSession />}>
          <Route element={<MerchantShell />}>
            <Route path="/app/charge" element={<ChargePage />} />
            <Route path="/app/sales" element={<SalesPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/score" element={<ScorePage />} />
            <Route path="/app/qr" element={<UniversalQrPage />} />
            <Route path="/app/balance" element={<BalancePage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
            <Route path="/app/system" element={<SystemPage />} />
          </Route>
          <Route element={<FocusShell />}>
            <Route path="/app/invoice/:id" element={<InvoicePage />} />
            <Route path="/app/payout" element={<PayoutFormPage />} />
            <Route path="/app/payout/confirm" element={<PayoutConfirmPage />} />
            <Route path="/app/payout/:id" element={<PayoutStatusPage />} />
          </Route>
        </Route>
        <Route path="/p/:slug" element={<PayPage />} />
        <Route path="/s/:token" element={<AttestationPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

function Gate() {
  const token = useSession((state) => state.token);
  if (token) return <Navigate to="/app/charge" replace />;
  if (isStandalone() || localStorage.getItem("jk.installLater") === "1") {
    return <Navigate to="/app/login" replace />;
  }
  return <Navigate to="/app/install" replace />;
}

function RequireSession() {
  const token = useSession((state) => state.token);
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) navigate("/app/login", { replace: true });
  }, [token, navigate]);
  if (!token) return <Navigate to="/app/login" replace />;
  return <Outlet />;
}
