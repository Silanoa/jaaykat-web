import { ChartColumn, Gauge, LogOut, QrCode, Receipt, UserRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useOnline } from "../hooks/useOnline";
import { useApi } from "../lib/api-context";
import { subscribeUnauthenticated } from "../lib/auth-events";
import { offlineBannerText } from "../lib/offline";
import { signOut } from "../lib/sign-out";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";
import { Button } from "./ui";

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
    <p className="mb-3 bg-accent/20 px-4 pt-[max(4px,env(safe-area-inset-top))] pb-1 text-center text-xs font-medium text-ink">Mode démo · sandbox, aucune somme réelle</p>
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

function MerchantFrame({ children, tabs }: { children: ReactNode; tabs: boolean }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col bg-bg text-ink lg:h-auto lg:min-h-dvh lg:max-w-none">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-64">
        <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col">
          <SandboxBanner />
          <OfflineBanner />
          <main
            className={`flex min-h-0 flex-1 flex-col ${tabs ? "pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}
          >
            {children}
          </main>
        </div>
      </div>
      {tabs ? <TabBar /> : null}
    </div>
  );
}

export function MerchantShell() {
  useProfile();
  return (
    <MerchantFrame tabs>
      <Outlet />
    </MerchantFrame>
  );
}

export function FocusShell() {
  useProfile();
  return (
    <MerchantFrame tabs={false}>
      <Outlet />
    </MerchantFrame>
  );
}

const BRAND_POINTS = [
  "Encaisser : un QR, le client choisit son moyen de paiement.",
  "Décider : ventes, heures de pointe et clients fidèles.",
  "Prouver : un score de régularité à partager.",
  "Retirer : vers Wave, Orange Money, Yas ou Expresso.",
];

function BrandPanel() {
  return (
    <aside
      data-testid="auth-brand"
      aria-label="Présentation de Jaaykat"
      className="hidden bg-primary p-12 text-white lg:flex lg:min-h-dvh lg:flex-col lg:justify-between"
    >
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl" />
        <p className="text-2xl font-bold">Jaaykat</p>
      </div>
      <div className="max-w-md">
        <p className="text-[40px] leading-[48px] font-bold">L'encaissement Lightning des petits commerces de Dakar.</p>
        <ul className="mt-8 flex flex-col gap-3 text-lg">
          {BRAND_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-white/80">Démo Code &amp; Chain Dakar 2026 · paiement simulé, aucune somme réelle.</p>
    </aside>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg text-ink lg:grid lg:min-h-dvh lg:grid-cols-[5fr_6fr]">
      <BrandPanel />
      <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col lg:h-auto lg:min-h-dvh lg:max-w-none">
        <SandboxBanner />
        <OfflineBanner />
        <main className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[520px] lg:justify-center lg:py-10">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-none">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}

export function ShopHeader() {
  const merchant = useSession((state) => state.merchant);
  return (
    <header className="mb-2 flex items-center justify-between gap-3 lg:justify-end">
      <p className="truncate text-lg font-semibold lg:hidden">{merchant?.displayName ?? "Jaaykat"}</p>
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

const SIDE_LINKS = [
  { to: "/app/charge", label: "Encaisser", icon: QrCode },
  { to: "/app/sales", label: "Ventes", icon: Receipt },
  { to: "/app/dashboard", label: "Tableau de bord", icon: ChartColumn },
  { to: "/app/score", label: "Score", icon: Gauge },
  { to: "/app/payout", label: "Retirer", icon: Wallet },
] as const;

function sideActive(to: string, pathname: string): boolean {
  if (to === "/app/charge") return pathname === "/app/charge" || pathname.startsWith("/app/invoice");
  if (to === "/app/payout") return pathname.startsWith("/app/payout");
  return pathname === to;
}

function Sidebar() {
  const merchant = useSession((state) => state.merchant);
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const api = useApi();
  const online = useOnline();
  const [confirm, setConfirm] = useState(false);

  async function logout() {
    await signOut(api, online);
    navigate("/app/login", { replace: true });
  }

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-black/10 lg:bg-surface">
      <div className="flex items-center gap-3 px-4 pt-5">
        <img src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
        <p className="text-lg font-bold">Jaaykat</p>
      </div>
      <p className="truncate px-4 pt-3 text-sm font-semibold">{merchant?.displayName ?? "Boutique"}</p>
      <nav aria-label="Espace marchand" className="mt-4 flex min-h-0 flex-1 flex-col gap-1 px-2 pb-4">
        {SIDE_LINKS.map((link) => {
          const Icon = link.icon;
          const active = sideActive(link.to, pathname);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm ${active ? "bg-success-bg font-semibold text-primary" : "text-ink"}`}
            >
              <Icon aria-hidden="true" size={20} />
              {link.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          className="mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-danger"
          onClick={() => setConfirm(true)}
        >
          <LogOut aria-hidden="true" size={20} />
          Déconnexion
        </button>
      </nav>
      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label="Confirmer la déconnexion">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-4">
            <p>Vous devrez saisir votre numéro et votre PIN pour revenir.</p>
            <div className="mt-4 grid gap-2">
              <Button type="button" variant="danger" onClick={() => void logout()}>
                Se déconnecter
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto grid w-full max-w-[480px] grid-cols-4 border-t border-black/10 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
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
    <p role="status" className="jk-fade-in pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[448px] rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-[0_8px_24px_rgba(17,24,39,0.16)]">
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
