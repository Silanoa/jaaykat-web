import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LightningPanel } from "../components/lightning-panel";
import { PaidView } from "../components/paid-view";
import { PayLogo } from "../components/pay-logo";
import { AmountPad, AmountReadout } from "../components/pads";
import { PayStepper } from "../components/pay-stepper";
import { PublicShell } from "../components/shell";
import { Button, ErrorState, Page, Skeleton } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { usePayStart } from "../hooks/usePayStart";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { getDeviceId } from "../lib/device";
import { countdown, formatXof } from "../lib/format";
import { categoryLabel, payMethodLabel, payWithLabel } from "../lib/labels";
import { postBlockReason } from "../lib/offline";
import { PERSISTENT_FAILURE_MS, POLL_INTERVAL_MS, pollRetryDelay } from "../lib/resilience";
import { payChoices, payProgress, publicPayPhase } from "../lib/pay-demo";
import { invoiceSchema, type Invoice, type PayMethod, type PublicInvoice } from "../lib/schemas";
import { isTerminalInvoice, invoiceStatusLabel } from "../lib/status";

function saveCreated(invoice: Invoice) {
  sessionStorage.setItem(`jk.publicInvoice.${invoice.id}`, JSON.stringify(invoice));
}

function readCreated(id: string): Invoice | null {
  const raw = sessionStorage.getItem(`jk.publicInvoice.${id}`);
  if (!raw) return null;
  try {
    const parsed = invoiceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function PayPage() {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const aide = params.get("aide") === "1";
  const facture = params.get("facture");
  if (aide) return <Help slug={slug} />;
  if (facture) return <PaymentFlow slug={slug} invoiceId={facture} />;
  return <ShopCheckout slug={slug} />;
}

function ShopCheckout({ slug }: { slug: string }) {
  const api = useApi();
  const online = useOnline();
  const [params, setParams] = useSearchParams();
  const preset = Number(params.get("a"));
  const [amount, setAmount] = useState(() => (Number.isInteger(preset) && preset > 0 ? preset : 0));
  const [payerName, setPayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const block = postBlockReason("public-invoice", online);
  const shop = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.getShop(slug),
    retry: false,
  });

  async function pay() {
    if (block || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const invoice = await api.createPublicInvoice(
        {
          slug,
          amountXof: amount,
          deviceId: getDeviceId(),
          ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
        },
        crypto.randomUUID(),
      );
      saveCreated(invoice);
      setParams({ facture: invoice.id });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Le paiement n'a pas démarré. Réessayez.");
      setBusy(false);
    }
  }

  if (shop.isLoading) {
    return (
      <PublicShell>
        <Page title="Paiement">
          <Skeleton className="h-24" />
        </Page>
      </PublicShell>
    );
  }

  if (shop.isError) {
    const missing = shop.error instanceof ApiError && shop.error.status === 404;
    return (
      <PublicShell>
        <Page title={missing ? "Boutique introuvable" : "Paiement"}>
          <ErrorState
            message={missing ? "Vérifiez le lien de la boutique." : shop.error instanceof ApiError ? shop.error.message : "Réessayez."}
            onRetry={missing ? undefined : () => void shop.refetch()}
          />
        </Page>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Page
        title={shop.data?.name ?? "Paiement"}
        action={
          <div>
            {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
            {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
            <Button type="button" disabled={amount <= 0 || Boolean(block)} busy={busy} onClick={() => void pay()}>
              Payer
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-muted">{shop.data ? categoryLabel(shop.data.category) : ""}</p>
        <AmountReadout value={amount} />
        <div className="my-3">
          <AmountPad value={amount} onChange={setAmount} />
        </div>
        <label className="block text-sm">
          Votre prénom ou téléphone (fidélité)
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-black/15 bg-surface px-3"
            value={payerName}
            onChange={(event) => setPayerName(event.target.value)}
          />
        </label>
        <p className="mt-2 text-sm text-muted">Ce champ est facultatif. Il sert seulement à reconnaître un client fidèle.</p>
        <Link to={`/p/${slug}?aide=1`} className="mt-4 inline-flex min-h-12 items-center text-primary">
          Comment payer ?
        </Link>
      </Page>
    </PublicShell>
  );
}

function DemoNote() {
  return <p className="mt-6 text-center text-xs text-subtle">Démo : paiement simulé, aucune somme réelle</p>;
}

function PaymentFlow({ slug, invoiceId }: { slug: string; invoiceId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const now = useNow();
  const online = useOnline();
  const [, setParams] = useSearchParams();
  const created = readCreated(invoiceId);
  const [selected, setSelected] = useState<PayMethod | null>(null);
  const mountedAt = useRef(Date.now());
  const block = postBlockReason("public-invoice", online);
  const shop = useQuery({ queryKey: ["shop", slug], queryFn: () => api.getShop(slug), retry: false });
  const queryKey = ["public-invoice", invoiceId];
  const poll = useQuery({
    queryKey,
    queryFn: () => api.getPublicInvoice(invoiceId),
    retry: (failureCount, caught) => !(caught instanceof ApiError && caught.status === 404) && failureCount < 3,
    retryDelay: pollRetryDelay,
    refetchInterval: (state) => {
      const current = state.state.data?.status;
      if (current && isTerminalInvoice(current)) return false;
      return POLL_INTERVAL_MS;
    },
  });
  const payStart = usePayStart({
    send: (method) => api.payPublicInvoice(invoiceId, method),
    onAccepted: (result) => {
      const existing = queryClient.getQueryData<PublicInvoice>(queryKey);
      if (existing && isTerminalInvoice(existing.status)) return;
      queryClient.setQueryData(queryKey, { ...existing, ...result });
    },
    onConflict: () => void queryClient.invalidateQueries({ queryKey }),
  });
  const status = poll.data?.status ?? created?.status ?? "creating";
  const amount = poll.data?.amountXof ?? created?.amountXof ?? 0;
  const expiresAt = poll.data?.expiresAt ?? created?.expiresAt ?? null;
  const demoPayment = Boolean(poll.data?.demoPayment ?? created?.demoPayment);
  const payMethod = poll.data?.payMethod ?? payStart.method ?? created?.payMethod ?? null;
  const bolt11 = poll.data?.bolt11 ?? created?.bolt11 ?? null;
  const phase = publicPayPhase({ status, demoPayment, payMethod });
  const clock = expiresAt ? countdown(expiresAt, now) : null;
  const shopName = shop.data?.name ?? "";
  const receivedAt = useRef<string | null>(null);
  if (phase === "paid" && receivedAt.current === null) receivedAt.current = new Date().toISOString();
  const pollFailing = poll.isError && now - (poll.dataUpdatedAt || mountedAt.current) > PERSISTENT_FAILURE_MS;
  const missing = poll.error instanceof ApiError && poll.error.status === 404;

  function confirm() {
    if (block || !selected) return;
    payStart.start(selected);
  }

  if (!poll.data && !created) {
    if (missing || pollFailing) {
      return (
        <PublicShell>
          <Page title={shopName || "Paiement"}>
            <ErrorState
              message={missing ? "Cette facture est introuvable. Vérifiez le QR." : "La connexion est instable."}
              onRetry={missing ? undefined : () => void poll.refetch()}
            />
          </Page>
        </PublicShell>
      );
    }
    return (
      <PublicShell>
        <Page title={shopName || " "}>
          <Skeleton className="mx-auto h-14 w-48" />
          <div className="mt-6 grid gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        </Page>
      </PublicShell>
    );
  }

  if (phase === "paid") {
    return (
      <PublicShell>
        <PaidView
          title="Paiement reçu"
          amountXof={amount}
          paidAt={receivedAt.current}
          subject={shopName}
          proof={
            created?.paymentHash
              ? { kind: "Preuve", value: created.paymentHash }
              : { kind: "Référence", value: invoiceId }
          }
          primary={
            <Button type="button" onClick={() => setParams({})}>
              Fermer
            </Button>
          }
        />
      </PublicShell>
    );
  }

  if (phase === "expired" || phase === "failed") {
    return (
      <PublicShell>
        <Page
          title={status === "expired" ? "Facture expirée" : "Paiement non abouti"}
          action={
            <Button type="button" onClick={() => setParams({})}>
              Nouvelle facture
            </Button>
          }
        >
          <p role="status">{invoiceStatusLabel(status)} Recommencez le paiement.</p>
        </Page>
      </PublicShell>
    );
  }

  if (phase === "choose" && selected === null) {
    return (
      <PublicShell>
        <Page title={shopName || "Paiement"}>
          <p className="tabular text-center text-[40px] leading-[48px] font-bold">{formatXof(amount)}</p>
          <p className="mt-1 text-center text-sm text-muted">Choisissez comment payer</p>
          <div className="mt-5 grid gap-2">
            {payChoices().map((choice) => (
              <button
                key={choice.method}
                type="button"
                aria-label={`${choice.label}, ${choice.hint}`}
                disabled={Boolean(block)}
                onClick={() => setSelected(choice.method)}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-black/10 bg-surface px-4 text-left shadow-[0_1px_2px_rgba(17,24,39,0.06)] active:bg-bg disabled:opacity-50"
              >
                <PayLogo method={choice.method} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{choice.label}</span>
                  <span className="text-sm text-muted">{choice.hint}</span>
                </span>
                <ChevronRight aria-hidden="true" size={20} className="text-subtle" />
              </button>
            ))}
          </div>
          {block ? <p className="mt-3 text-sm text-warning">{block}</p> : null}
          <DemoNote />
        </Page>
      </PublicShell>
    );
  }

  if (phase === "choose" && selected !== null) {
    const lightning = selected === "lightning";
    return (
      <PublicShell>
        <Page
          title="Confirmer le paiement"
          action={
            <div className="grid gap-2">
              {block ? <p className="text-sm text-warning">{block}</p> : null}
              {payStart.error ? (
                <p role="alert" className="text-sm text-danger">
                  {payStart.error}
                </p>
              ) : null}
              <Button type="button" disabled={Boolean(block)} onClick={confirm}>
                Confirmer le paiement de {formatXof(amount)}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                Changer de moyen
              </Button>
            </div>
          }
        >
          <dl className="divide-y divide-black/10 rounded-2xl bg-surface text-sm shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted">Boutique</dt>
              <dd className="truncate font-medium">{shopName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted">Moyen</dt>
              <dd className="flex items-center gap-2 font-medium">
                <PayLogo method={selected} size={28} />
                {payMethodLabel(selected)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted">Montant</dt>
              <dd className="tabular text-lg font-bold">{formatXof(amount)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm font-medium">Vous payez avec {payWithLabel(selected)}.</p>
          <p className="mt-2 text-sm text-muted">
            {lightning
              ? "Vous payez la facture Lightning avec votre portefeuille. En démo sandbox, le règlement est simulé : le réseau de test ne permet pas de payer réellement."
              : "Démo : le paiement est simulé, aucune somme réelle n'est débitée."}
          </p>
          <DemoNote />
        </Page>
      </PublicShell>
    );
  }

  const steps = payProgress({ status, payMethod });
  const current = steps.find((step) => step.state === "current");
  const preparing = payMethod === "lightning" && demoPayment && bolt11 === null;
  const showWallet = bolt11 !== null && (payMethod === "lightning" || !demoPayment);
  return (
    <PublicShell>
      <Page title="Paiement en cours">
        <div className="jk-fade-in">
          <p className="text-sm text-muted">{shopName}</p>
          <p className="tabular mt-1 text-[32px] leading-10 font-bold">{formatXof(amount)}</p>
          {payMethod ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <PayLogo method={payMethod} size={28} />
              Paiement avec {payWithLabel(payMethod)}
            </p>
          ) : null}
          <div className="mt-6">
            <PayStepper steps={steps} />
          </div>
          <p role="status" aria-live="polite" className="mt-4 min-h-6 text-center text-sm font-medium">
            {current ? `${current.label} en cours` : ""}
          </p>
          {preparing ? (
            <div className="mt-4 flex flex-col items-center" role="status">
              <Skeleton className="size-[220px] rounded-2xl" />
              <Skeleton className="mt-3 h-12 w-full max-w-sm" />
              <Skeleton className="mt-2 h-12 w-full max-w-sm" />
              <p className="mt-3 text-center text-xs text-subtle">Préparation de la facture Lightning…</p>
            </div>
          ) : null}
          {showWallet && bolt11 ? (
            <div className="mt-4">
              <LightningPanel
                bolt11={bolt11}
                note={
                  demoPayment
                    ? "Démo sandbox : le règlement est simulé, le réseau de test ne permet pas de payer réellement."
                    : "Payez cette facture avec n'importe quel portefeuille Lightning."
                }
              />
            </div>
          ) : null}
          {clock ? (
            <p className="tabular mt-4 text-center text-sm text-muted">
              Expire dans {clock.mmss} · à {clock.expiresClock}
            </p>
          ) : null}
          {demoPayment ? null : (
            <p className="mt-2 text-center text-xs text-subtle">
              Démo sandbox : la confirmation se fait automatiquement, sans paiement réel.
            </p>
          )}
          {payStart.failed ? (
            <p role="alert" className="mt-3 text-center text-sm text-danger">
              Le paiement n'a pas pu être envoyé.{" "}
              <button type="button" className="min-h-12 underline" onClick={payStart.retry}>
                Réessayer
              </button>
            </p>
          ) : pollFailing ? (
            <p role="alert" className="mt-3 text-center text-sm text-danger">
              Connexion instable, la vérification continue.{" "}
              <button type="button" className="min-h-12 underline" onClick={() => void poll.refetch()}>
                Réessayer
              </button>
            </p>
          ) : null}
          {demoPayment ? <DemoNote /> : null}
        </div>
      </Page>
    </PublicShell>
  );
}

function Help({ slug }: { slug: string }) {
  const api = useApi();
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.health(), retry: false });
  const simulated = health.data?.demoPayMode === "manual";
  return (
    <PublicShell>
      <Page
        title="Comment payer ?"
        action={
          <Link to={`/p/${slug}`} className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white">
            Retour
          </Link>
        }
      >
        {simulated ? (
          <p>
            Démo : aucune somme réelle n'est débitée. Après avoir scanné le QR, vous choisissez Wave, Orange Money,
            Yas ou Expresso, puis le paiement est simulé.
          </p>
        ) : (
          <>
            <p>
              Ce paiement passe par le réseau Bitcoin Lightning. Hors démo, il faut une application de portefeuille
              Lightning. Un compte mobile money ne permet pas de payer cette facture.
            </p>
            <p className="mt-3">
              Pendant la démo, aucune somme réelle n'est débitée. La confirmation se fait toute seule.
            </p>
          </>
        )}
      </Page>
    </PublicShell>
  );
}
