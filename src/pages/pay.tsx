import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AmountPad, AmountReadout } from "../components/pads";
import { QrImage } from "../components/qr-image";
import { PublicShell } from "../components/shell";
import { Button, ErrorState, Page, Skeleton } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { getDeviceId } from "../lib/device";
import { countdown, formatSats, formatWhen, formatXof } from "../lib/format";
import { categoryLabel } from "../lib/labels";
import { postBlockReason } from "../lib/offline";
import { invoiceSchema, type Invoice } from "../lib/schemas";
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

function PaymentFlow({ slug, invoiceId }: { slug: string; invoiceId: string }) {
  const api = useApi();
  const now = useNow();
  const [, setParams] = useSearchParams();
  const created = readCreated(invoiceId);
  const shop = useQuery({ queryKey: ["shop", slug], queryFn: () => api.getShop(slug), retry: false });
  const poll = useQuery({
    queryKey: ["public-invoice", invoiceId],
    queryFn: () => api.getPublicInvoice(invoiceId),
    refetchInterval: (state) => {
      const status = state.state.data?.status;
      if (status && isTerminalInvoice(status)) return false;
      return 2000;
    },
  });
  const status = poll.data?.status ?? created?.status ?? "creating";
  const amount = poll.data?.amountXof ?? created?.amountXof ?? 0;
  const expiresAt = poll.data?.expiresAt ?? created?.expiresAt ?? null;
  const clock = expiresAt ? countdown(expiresAt, now) : null;

  if (status === "paid") {
    return (
      <PublicShell>
        <Page
          title="Paiement reçu"
          action={
            <Button type="button" onClick={() => setParams({})}>
              Fermer
            </Button>
          }
        >
          <p className="tabular text-[40px] leading-[48px] font-bold">{formatXof(amount)}</p>
          <p className="mt-2">{shop.data?.name}</p>
          <p className="text-sm text-muted">{formatWhen(new Date().toISOString())}</p>
          {created?.paymentHash ? <p className="mt-2 text-sm">Preuve {created.paymentHash.slice(0, 4)}…{created.paymentHash.slice(-2)}</p> : (
            <p className="mt-2 text-sm">Référence {invoiceId.slice(0, 4)}…{invoiceId.slice(-2)}</p>
          )}
        </Page>
      </PublicShell>
    );
  }

  if (status === "expired" || status === "failed") {
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
          <p>{invoiceStatusLabel(status)} Recommencez le paiement.</p>
        </Page>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Page title="Paiement en cours">
        <p className="text-sm text-muted">{shop.data?.name}</p>
        <p className="tabular mt-2 text-[32px] font-bold">{formatXof(amount)}</p>
        {created ? <p className="text-sm text-muted">{formatSats(created.amountSats)}</p> : null}
        <div className="my-4">
          <QrImage value={created?.bolt11 ?? null} label="QR de la facture" />
        </div>
        <p className="text-center">{invoiceStatusLabel(status)}</p>
        {clock ? (
          <p className="text-center text-sm tabular">
            {clock.mmss} · expire à {clock.expiresClock}
          </p>
        ) : null}
        <p className="mt-3 text-center text-sm">Paiement simulé · sandbox : confirmation automatique en ~5 s</p>
        <button
          type="button"
          className="mt-4 min-h-12 w-full text-primary"
          disabled={!created?.bolt11}
          onClick={() => {
            if (!created?.bolt11) return;
            void navigator.clipboard.writeText(created.bolt11);
          }}
        >
          Copier la facture
        </button>
        {poll.isError ? (
          <p className="mt-2 text-sm text-danger">
            {poll.error instanceof ApiError ? poll.error.message : "Vérification impossible."}{" "}
            <button type="button" className="underline" onClick={() => void poll.refetch()}>
              Réessayer
            </button>
          </p>
        ) : null}
      </Page>
    </PublicShell>
  );
}

function Help({ slug }: { slug: string }) {
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
        <p>
          Ce paiement passe par le réseau Bitcoin Lightning. Hors démo, il faut une application de portefeuille
          Lightning. Un compte mobile money ne permet pas de payer cette facture.
        </p>
        <p className="mt-3">Pendant la démo, le paiement est simulé et se confirme tout seul en quelques secondes.</p>
      </Page>
    </PublicShell>
  );
}
