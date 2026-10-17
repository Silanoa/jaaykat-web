import { ChartColumn, Gauge, QrCode, Receipt, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useOnline } from "../hooks/useOnline";
import { useApi } from "../lib/api-context";
import { subscribeUnauthenticated } from "../lib/auth-events";
import { offlineBannerText } from "../lib/offline";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

export function SessionListener() {
  const navigate = useNavigate();
  useEffect(
    () =>
      subscribeUnauthenticated(() => {
        useSession.getState().clear();
        navigate("/app/login", { replace: true, state: { expired: true } });
      }),
    [navigate],
  );
  return null;
}

export function SandboxBanner() {
  return (
    <p className="bg-accent px-4 py-1 text-center text-sm font-medium text-ink">Paiement simulé · sandbox</p>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const cachedAt = useSession((state) => state.cachedAt);
  if (online) return null;
  return (
    <p role="status" className="bg-warning-bg px-4 py-2 text-center text-sm text-warning">
      {offlineBannerText(cachedAt)}
    </p>
  );
}

export function AppFrame({ children, tabs = false }: { children: ReactNode; tabs?: boolean }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col bg-bg text-ink">
      <SandboxBanner />
      <OfflineBanner />
      <main className={`flex min-h-0 flex-1 flex-col ${tabs ? "pb-[calc(56px+env(safe-area-inset-bottom))]" : ""}`}>
        {children}
      </main>
      {tabs ? <TabBar /> : null}
    </div>
  );
}

export function MerchantShell() {
  useProfile();
  return (
    <AppFrame tabs>
      <Outlet />
    </AppFrame>
  );
}

export function FocusShell() {
  useProfile();
  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}

export function ShopHeader() {
  const merchant = useSession((state) => state.merchant);
  return (
    <header className="mb-2 flex items-center justify-between gap-3">
      <p className="truncate text-lg font-semibold">{merchant?.displayName ?? "Jaaykat"}</p>
      <div className="flex items-center gap-1">
        <NavLink
          to="/app/balance"
          className="inline-flex min-h-12 items-center rounded-full bg-success-bg px-3 text-sm font-semibold text-primary"
        >
          Solde
        </NavLink>
        <NavLink to="/app/settings" aria-label="Compte" className="grid size-12 place-items-center">
          <UserRound aria-hidden="true" />
        </NavLink>
      </div>
    </header>
  );
}

const TABS = [
  { to: "/app/charge", label: "Encaisser", icon: QrCode },
  { to: "/app/sales", label: "Ventes", icon: Receipt },
  { to: "/app/dashboard", label: "Tableau", icon: ChartColumn },
  { to: "/app/score", label: "Score", icon: Gauge },
] as const;

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto grid w-full max-w-[480px] grid-cols-4 border-t border-black/10 bg-surface pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? "font-semibold text-primary" : "text-muted"}`
            }
          >
            <Icon aria-hidden="true" size={22} strokeWidth={2} />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function ToastViewport() {
  const message = useToast((state) => state.message);
  const hide = useToast((state) => state.hide);
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(hide, 3200);
    return () => window.clearTimeout(id);
  }, [message, hide]);
  if (!message) return null;
  return (
    <p role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[448px] rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-[0_8px_24px_rgba(17,24,39,0.16)]">
      {message}
    </p>
  );
}

export function BackButton({ to, label = "Retour" }: { to: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} className="mb-2 min-h-12 text-sm font-medium text-primary">
      {label}
    </button>
  );
}

export function useProfile() {
  const api = useApi();
  const token = useSession((state) => state.token);
  const setProfile = useSession((state) => state.setProfile);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.me().then((me) => {
      if (!cancelled) setProfile(me);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, token, setProfile]);
}
