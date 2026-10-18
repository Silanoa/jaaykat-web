import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AmountPad, AmountReadout } from "../components/pads";
import { NetworkPicker } from "../components/network-picker";
import { PayLogo } from "../components/pay-logo";
import { BackButton, ShopHeader } from "../components/shell";
import { Button, ErrorState, Field, Page, Skeleton } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { countdown, formatSats, formatWhen, formatXof } from "../lib/format";
import { networkLabel, networkLogoMethod, payoutStatusLabel } from "../lib/labels";
import { postBlockReason } from "../lib/offline";
import { PERSISTENT_FAILURE_MS, POLL_INTERVAL_MS } from "../lib/resilience";
import { signOut } from "../lib/sign-out";
import { readQuickAmounts, writeQuickAmounts } from "../lib/quick-amounts";
import type { PayoutNetwork, PayoutQuote } from "../lib/schemas";
import { normalizePhone, payoutAmountError } from "../lib/validation";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

const inputClass = "min-h-12 w-full rounded-lg border border-black/15 bg-surface px-3";

function isTerminalPayout(status: string): boolean {
  return status === "completed" || status === "failed" || status === "expired";
}

export function BalancePage() {
  const api = useApi();
  const online = useOnline();
  const query = useQuery({ queryKey: ["balance"], queryFn: () => api.balance() });
  const now = useNow();
  return (
    <Page
      title="Solde"
      action={
        <Link
          to="/app/payout"
          className={`inline-flex min-h-14 w-full items-center justify-center rounded-xl font-semibold ${online ? "bg-primary text-white" : "bg-primary/40 text-white"}`}
          aria-disabled={!online}
          onClick={(event) => {
            if (!online) event.preventDefault();
          }}
        >
          Retirer vers mobile money
        </Link>
      }
    >
      <ShopHeader />
      {!online ? <p className="mb-3 text-sm text-warning">{postBlockReason("payout", false)}</p> : null}
      {query.isLoading ? <Skeleton className="h-24" /> : null}
      {query.isError && query.data && now - query.dataUpdatedAt > PERSISTENT_FAILURE_MS ? (
        <p role="alert" className="mb-2 text-sm text-warning">
          Mise à jour impossible, données affichées peut-être périmées.{" "}
          <button type="button" className="min-h-12 underline" onClick={() => void query.refetch()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {query.isError && !query.data ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Solde indisponible."}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <div>
          <p className="text-sm font-medium text-muted">Solde retirable</p>
          <p className="tabular text-[40px] leading-[48px] font-bold">{formatXof(query.data.balanceXof)}</p>
          <p className="text-sm text-muted">{formatSats(query.data.balanceSats)}</p>
          {query.data.balanceXof === 0 ? <p className="mt-2 text-sm">Pas encore de ventes retirables.</p> : null}
          <p className="mt-3 text-sm text-muted">
            Ventes payées en direct moins vos retraits. Ce solde est le ledger interne, pas un compte mobile money.
          </p>
          {query.data.demoSalesCount > 0 ? (
            <section aria-labelledby="demo-revenue" className="mt-4 rounded-xl bg-warning-bg px-4 py-3">
              <h2 id="demo-revenue" className="text-sm font-semibold text-warning">
                Chiffre d'affaires de démonstration
              </h2>
              <p className="tabular text-lg font-bold">{formatXof(query.data.demoRevenueXof)}</p>
              <p className="text-sm">
                {query.data.demoSalesCount} ventes simulées. Non retirable, exclu du solde retirable ci-dessus.
              </p>
            </section>
          ) : null}
          <h2 className="mt-6 font-semibold">Derniers retraits</h2>
          {query.data.lastPayouts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucun retrait.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {query.data.lastPayouts.map((payout) => (
                <li key={payout.id}>
                  <Link to={`/app/payout/${payout.id}`} className="block rounded-xl bg-surface px-3 py-3">
                    <span className="tabular font-semibold">{formatXof(payout.amountXof)}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {networkLabel(payout.network)} · {payoutStatusLabel(payout.status)} · {formatWhen(payout.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Page>
  );
}

export function PayoutFormPage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const balance = useQuery({ queryKey: ["balance"], queryFn: () => api.balance() });
  const [amount, setAmount] = useState(0);
  const [network, setNetwork] = useState<PayoutNetwork>("wave");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const block = postBlockReason("payout", online);
  const amountError = amount === 0 ? null : payoutAmountError(amount, balance.data?.balanceXof ?? null);
  const phoneOk = normalizePhone(phone);

  async function quote() {
    if (block || !phoneOk || amountError || amount === 0 || name.trim().length < 1) {
      setError(amountError ?? (!phoneOk ? "Numéro invalide" : "Indiquez le nom du titulaire."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payoutQuote = await api.quotePayout({
        amountXof: amount,
        network,
        accountNumber: phoneOk,
        accountName: name.trim(),
      });
      navigate("/app/payout/confirm", { state: { quote: payoutQuote } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Le devis a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      action={
        <div>
          {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button type="button" disabled={Boolean(block) || busy} busy={busy} onClick={() => void quote()}>
            Voir le montant reçu
          </Button>
        </div>
      }
    >
      <BackButton to="/app/balance" />
      <h1 className="mb-2 text-[28px] font-bold">Retrait</h1>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div>
      <p className="mb-1 text-sm">
        Solde retirable :{" "}
        <strong className="tabular">{balance.data ? formatXof(balance.data.balanceXof) : "…"}</strong>
      </p>
      <p className="mb-2 text-sm text-muted">Entre 100 et 200 000 F. Simulation sandbox : aucun argent réel.</p>
      <AmountReadout value={amount} />
      {amountError ? <p className="text-center text-sm text-danger">{amountError}</p> : null}
      <div className="my-3">
        <AmountPad value={amount} onChange={setAmount} />
      </div>
      <NetworkPicker value={network} onChange={setNetwork} />
      <Field id="payout-phone" label="Numéro" hint="9 chiffres commençant par 7">
        <div className="flex gap-2">
          <span className="inline-flex min-h-12 items-center rounded-lg bg-surface px-3">+221</span>
          <input id="payout-phone" className={inputClass} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
      </Field>
      <div className="mt-3">
        <Field id="payout-name" label="Nom du titulaire">
          <input id="payout-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      </div>
      <aside className="mt-6 hidden rounded-2xl bg-surface p-6 lg:block">
        <h2 className="text-lg font-semibold">Récapitulatif</h2>
        <p className="mt-3 text-sm text-muted">Montant</p>
        <p className="tabular text-2xl font-bold">{formatXof(amount)}</p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          <PayLogo method={networkLogoMethod(network)} size={28} />
          {networkLabel(network)}
        </p>
        <p className="text-sm">{phoneOk ?? "Numéro à saisir"}</p>
        <p className="text-sm">{name.trim() || "Titulaire à saisir"}</p>
        <p className="mt-3 text-sm text-muted">Le montant reçu et les frais viennent du devis, pas d'un calcul dans l'application.</p>
      </aside>
      </div>
    </Page>
  );
}

export function PayoutConfirmPage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow();
  const quote = (location.state as { quote?: PayoutQuote } | null)?.quote ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const block = postBlockReason("payout", online);
  const clock = quote ? countdown(quote.expiresAt, now) : null;

  async function confirm() {
    if (!quote || block || clock?.expired) return;
    setBusy(true);
    try {
      const payout = await api.createPayout(quote.id, crypto.randomUUID());
      navigate(`/app/payout/${payout.id}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Le retrait n'a pas abouti. Réessayez.");
      setBusy(false);
    }
  }

  if (!quote) {
    return (
      <Page title="Devis">
        <p>Ce devis n'est plus affiché. Recommencez le retrait.</p>
        <Link to="/app/payout" className="mt-4 inline-flex min-h-12 items-center text-primary">
          Modifier
        </Link>
      </Page>
    );
  }

  return (
    <Page
      title="Confirmer le retrait"
      action={
        <div className="grid gap-2">
          {block ? <p className="text-sm text-warning">{block}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="button" disabled={Boolean(block) || Boolean(clock?.expired)} busy={busy} onClick={() => void confirm()}>
            Confirmer le retrait
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/app/payout")}>
            Modifier
          </Button>
        </div>
      }
    >
      <p className="text-sm text-info">Simulation, aucun argent réel.</p>
      <div className="mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <div>
          <p className="text-sm text-muted">Montant envoyé</p>
          <p className="tabular text-2xl font-bold">{formatXof(quote.amountXof)}</p>
          <p className="mt-3 text-sm text-muted">Montant reçu</p>
          <p className="tabular text-2xl font-bold">{formatXof(quote.receivedXof)}</p>
        </div>
        <div>
          <p className="text-sm">Taux {quote.exchangeRate} · frais {quote.fees}</p>
          <p className="flex items-center gap-2 text-sm">
            <PayLogo method={networkLogoMethod(quote.network)} size={28} />
            <span>
              {networkLabel(quote.network)} · {quote.accountNumberMasked} · {quote.accountName}
            </span>
          </p>
        </div>
      </div>
      {clock ? (
        <p className={`mt-3 tabular ${clock.urgent || clock.expired ? "text-warning" : ""}`}>
          {clock.expired ? "Devis expiré" : `Valable encore ${clock.mmss} · expire à ${clock.expiresClock}`}
        </p>
      ) : null}
      {clock?.expired ? (
        <button type="button" className="mt-2 min-h-12 text-primary" onClick={() => navigate("/app/payout")}>
          Actualiser le devis
        </button>
      ) : null}
    </Page>
  );
}

export function PayoutStatusPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["payout", id],
    queryFn: () => api.getPayout(id),
    refetchInterval: (state) => {
      const status = state.state.data?.status;
      if (!status || isTerminalPayout(status)) return false;
      return POLL_INTERVAL_MS;
    },
  });
  const now = useNow();
  const payout = query.data;
  return (
    <Page
      title="Suivi du retrait"
      action={
        <Button type="button" onClick={() => navigate("/app/balance")}>
          Terminé
        </Button>
      }
    >
      <p className="text-sm text-muted">Simulation, aucun argent réel.</p>
      {query.isLoading ? <Skeleton className="mt-4 h-24" /> : null}
      {query.isError && query.data && now - query.dataUpdatedAt > PERSISTENT_FAILURE_MS ? (
        <p role="alert" className="mb-2 text-sm text-warning">
          Mise à jour impossible, données affichées peut-être périmées.{" "}
          <button type="button" className="min-h-12 underline" onClick={() => void query.refetch()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {query.isError && !payout ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : "Suivi indisponible."} onRetry={() => void query.refetch()} />
      ) : null}
      {payout ? (
        <div className="mt-4">
          <p className="text-lg font-semibold">{payoutStatusLabel(payout.status)}</p>
          <p className="tabular mt-2 text-2xl font-bold">{formatXof(payout.amountXof)}</p>
          <p className="text-sm">{networkLabel(payout.network)}</p>
          <p className="text-sm text-muted">Référence {payout.reference}</p>
          {payout.failureReason ? <p className="mt-2 text-sm text-danger">{payout.failureReason}</p> : null}
          <ol className="mt-4 flex flex-col gap-2 text-sm">
            <li>Demandé</li>
            <li>En cours</li>
            <li>Envoyé</li>
          </ol>
          {(payout.status === "failed" || payout.status === "expired") ? (
            <button type="button" className="mt-4 min-h-12 text-primary" onClick={() => navigate("/app/payout")}>
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}
    </Page>
  );
}

export function SettingsPage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const user = useSession((state) => state.user);
  const merchant = useSession((state) => state.merchant);
  const [confirm, setConfirm] = useState(false);
  const [amounts, setAmounts] = useState(() => readQuickAmounts().map(String));

  function saveAmounts() {
    const values = amounts.map((value) => Number(value));
    if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
      useToast.getState().show("Indiquez quatre montants entiers.");
      return;
    }
    writeQuickAmounts(values);
    useToast.getState().show("Montants enregistrés sur cet appareil");
  }

  async function logout() {
    await signOut(api, online);
    navigate("/app/login", { replace: true });
  }

  return (
    <Page title="Compte">
      <ShopHeader />
      <p className="font-semibold">{merchant?.displayName}</p>
      <p className="text-sm text-muted">{merchant?.category}</p>
      <p className="mt-2 text-sm">Numéro {user?.phoneMasked ?? "—"}</p>
      <p className="mt-4 text-sm">Langue : français. Wolof : bientôt.</p>
      <p className="mt-2 text-sm">Mode démo : sandbox. Les paiements sont simulés.</p>
      <h2 className="mt-6 font-semibold">Montants rapides</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {amounts.map((value, index) => (
          <input
            key={index}
            aria-label={`Montant rapide ${index + 1}`}
            className={inputClass}
            inputMode="numeric"
            value={value}
            onChange={(event) => {
              const next = [...amounts];
              next[index] = event.target.value;
              setAmounts(next);
            }}
          />
        ))}
      </div>
      <button type="button" className="mt-2 min-h-12 text-primary" onClick={saveAmounts}>
        Enregistrer les montants
      </button>
      <div className="mt-4 flex flex-col">
        <Link to="/app/qr" className="inline-flex min-h-12 items-center">
          Mon QR permanent
        </Link>
        <Link to="/app/install" className="inline-flex min-h-12 items-center">
          Installer l'application
        </Link>
        <Link to="/app/system" className="inline-flex min-h-12 items-center">
          Journal API (jury)
        </Link>
        <a className="inline-flex min-h-12 items-center" href="https://github.com/Silanoa/jaaykat-web">
          Code source
        </a>
        <p className="py-2 text-sm text-muted">Licence MIT. Jaaykat, Code & Chain Dakar 2026.</p>
      </div>
      <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
        Se déconnecter
      </Button>
      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label="Confirmer la déconnexion">
          <div className="w-full max-w-[480px] rounded-t-[20px] bg-surface p-4 pb-8">
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
    </Page>
  );
}

export function SystemPage() {
  const api = useApi();
  const query = useQuery({ queryKey: ["system"], queryFn: () => api.system() });
  return (
    <Page title="Journal API">
      <BackButton to="/app/settings" />
      {query.isLoading ? <Skeleton className="h-24" /> : null}
      {query.isError && !query.data ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : "Journal indisponible."} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="flex flex-col gap-4">
          <p>Environnement : {query.data.env}</p>
          {query.data.seedHistory !== undefined ? (
            <p>Historique simulé : {query.data.seedHistory ? "oui" : "non"}</p>
          ) : (
            <p className="text-sm text-muted">L'historique seed est marqué sur chaque vente, pas dans ce journal.</p>
          )}
          <section>
            <h2 className="font-semibold">Soldes plateforme</h2>
            <BalanceList value={query.data.platformBalances} />
          </section>
          <section>
            <h2 className="font-semibold">Derniers appels</h2>
            {query.data.lastCalls.length === 0 ? (
              <p className="text-sm text-muted">Aucun appel.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {query.data.lastCalls.map((call) => (
                  <li key={`${call.at}-${call.correlationId ?? call.path}`} className="rounded-xl bg-surface px-3 py-2 text-sm">
                    <span className="tabular">{formatWhen(call.at)}</span>
                    <span className="mt-1 block">
                      {call.method} {call.path} · {call.status ?? "—"} · {call.durationMs ?? "—"} ms
                    </span>
                    {call.correlationId ? <span className="text-muted">{call.correlationId}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Page>
  );
}

function BalanceList({ value }: { value: unknown }) {
  const rows = readBalances(value);
  if (rows.length === 0) return <p className="text-sm text-muted">Aucun solde renvoyé.</p>;
  return (
    <ul className="mt-2">
      {rows.map((row) => (
        <li key={row.label} className="text-sm">
          {row.label} · {row.amount}
        </li>
      ))}
    </ul>
  );
}

function readBalances(value: unknown): { label: string; amount: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (!("asset" in record) || !("amount" in record)) return [];
      return [{ label: String(record.asset), amount: String(record.amount) }];
    });
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([label, amount]) => ({
      label,
      amount: typeof amount === "string" || typeof amount === "number" ? String(amount) : "—",
    }));
  }
  return [];
}
