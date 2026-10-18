import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { FocusShell, MerchantShell, SessionListener, ToastViewport } from "../components/shell";
import { isStandalone } from "../lib/install";
import { ChargePage } from "../pages/charge";
import { InvoicePage } from "../pages/invoice";
import { useSession } from "../stores/session";

const AttestationPage = lazy(() => import("../pages/attestation").then((m) => ({ default: m.AttestationPage })));
const ForgotPage = lazy(() => import("../pages/auth").then((m) => ({ default: m.ForgotPage })));
const InstallPage = lazy(() => import("../pages/auth").then((m) => ({ default: m.InstallPage })));
const LoginPage = lazy(() => import("../pages/auth").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../pages/auth").then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import("../pages/lists").then((m) => ({ default: m.DashboardPage })));
const SalesPage = lazy(() => import("../pages/lists").then((m) => ({ default: m.SalesPage })));
const ScorePage = lazy(() => import("../pages/lists").then((m) => ({ default: m.ScorePage })));
const BalancePage = lazy(() => import("../pages/money").then((m) => ({ default: m.BalancePage })));
const PayoutConfirmPage = lazy(() => import("../pages/money").then((m) => ({ default: m.PayoutConfirmPage })));
const PayoutFormPage = lazy(() => import("../pages/money").then((m) => ({ default: m.PayoutFormPage })));
const PayoutStatusPage = lazy(() => import("../pages/money").then((m) => ({ default: m.PayoutStatusPage })));
const SettingsPage = lazy(() => import("../pages/money").then((m) => ({ default: m.SettingsPage })));
const SystemPage = lazy(() => import("../pages/money").then((m) => ({ default: m.SystemPage })));
const PayPage = lazy(() => import("../pages/pay").then((m) => ({ default: m.PayPage })));
const UniversalQrPage = lazy(() => import("../pages/qr").then((m) => ({ default: m.UniversalQrPage })));

function RouteFallback() {
  return <div className="min-h-dvh bg-bg" aria-hidden="true" />;
}

export function AppRoutes() {
  return (
    <>
      <SessionListener />
      <ToastViewport />
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
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
