import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PaidView } from "../components/paid-view";
import { QrImage } from "../components/qr-image";
import { BackButton } from "../components/shell";
import { Button, ErrorState, Page, Skeleton } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { beep, celebratePayment, vibratePayment } from "../lib/celebrate";
import { countdown, formatSats, formatXof } from "../lib/format";
import { postBlockReason } from "../lib/offline";
import { PERSISTENT_FAILURE_MS, POLL_INTERVAL_MS, pollRetryDelay, shouldRetry } from "../lib/resilience";
import { invoiceQrPayload, merchantWaitCopy } from "../lib/pay-demo";
import { isTerminalInvoice } from "../lib/status";
import { useToast } from "../stores/toast";
import { UpdatedAgo } from "../components/updated-ago";

const seenPayments = new Set<string>();

export function InvoicePage() {
  const { id = "" } = useParams();
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useNow();
  const block = postBlockReason("invoice", online);
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id),
    retry: shouldRetry,
    retryDelay: pollRetryDelay,
    refetchInterval: (state) => {
      const status = state.state.data?.status;
      if (!status || isTerminalInvoice(status)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    if (query.data?.status !== "paid") return;
    celebratePayment(query.data.id, seenPayments, { beep, vibrate: vibratePayment });
    for (const key of ["dashboard", "sales", "balance", "score"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [query.data?.id, query.data?.status, queryClient]);

  async function regenerate() {
    if (!query.data || block) return;
    const created = await api.createInvoice(
      {
        amountXof: query.data.amountXof,
        ...(query.data.label ? { label: query.data.label } : {}),
      },
      crypto.randomUUID(),
    );
    navigate(`/app/invoice/${created.id}`, { replace: true });
  }

  async function copyInvoice() {
    if (!query.data) return;
    const payload = invoiceQrPayload(query.data);
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    useToast.getState().show("Facture copiée");
  }

  async function shareInvoice() {
    if (!query.data) return;
    const payload = invoiceQrPayload(query.data);
    if (!payload) return;
    if (navigator.share) {
      await navigator.share({ title: "Facture Jaaykat", text: payload });
      return;
    }
    await copyInvoice();
  }

  if (query.isLoading) {
    return (
      <Page>
        <BackButton to="/app/charge" label="Retour" />
        <h1 className="mb-2 text-[22px] leading-7 font-semibold">Facture</h1>
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="mt-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            <Skeleton className="mx-auto aspect-square w-full max-w-[240px] lg:max-w-[360px]" />
          </div>
        </div>
      </Page>
    );
  }

  if (!query.data) {
    const message = query.error instanceof ApiError ? query.error.message : "La facture est introuvable.";
    return (
      <Page title="Facture">
        <ErrorState message={message} onRetry={() => void query.refetch()} />
      </Page>
    );
  }

  const invoice = query.data;
  const pollFailing = query.isError && now - query.dataUpdatedAt > PERSISTENT_FAILURE_MS;
  const qrValue = invoiceQrPayload(invoice);
  const wait = merchantWaitCopy(invoice);
  if (invoice.status === "paid") {
    return (
      <PaidView
        title="Payé"
        amountXof={invoice.amountXof}
        amountSats={invoice.amountSats}
        paidAt={invoice.paidAt}
        subject={invoice.label}
        subjectLabel="Libellé"
        proof={
          invoice.paymentHash
            ? { kind: "Preuve", value: invoice.paymentHash }
            : { kind: "Référence", value: invoice.id }
        }
        primary={<Button type="button" onClick={() => navigate("/app/charge")}>Nouvelle vente</Button>}
        secondary={
          <Button type="button" variant="secondary" onClick={() => navigate(`/app/sales?vente=${invoice.id}`)}>
            Voir la vente
          </Button>
        }
      />
    );
  }

  const clock = invoice.expiresAt ? countdown(invoice.expiresAt, now) : null;
  const waiting = invoice.status === "pending" || invoice.status === "creating";

  return (
    <Page
      action={
        invoice.status === "expired" || invoice.status === "failed" ? (
          <div>
            {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
            <Button type="button" disabled={Boolean(block)} onClick={() => void regenerate()}>
              {invoice.status === "expired" ? "Régénérer" : "Réessayer"}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => navigate("/app/charge")}>
            Annuler
          </Button>
        )
      }
    >
      <BackButton to="/app/charge" label="Retour" />
      <h1 className="mb-2 text-[22px] leading-7 font-semibold">Facture</h1>
      {pollFailing && waiting ? (
        <p role="alert" className="mb-2 text-sm text-warning">
          Connexion instable, dernière mise à jour affichée.{" "}
          <button type="button" className="min-h-12 underline" onClick={() => void query.refetch()}>
            Réessayer
          </button>
        </p>
      ) : null}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
        <div>
          <p className="tabular text-center text-[32px] leading-10 font-bold lg:text-left lg:text-[40px] lg:leading-[48px]">{formatXof(invoice.amountXof)}</p>
          <p className="text-center text-sm text-muted lg:text-left">{formatSats(invoice.amountSats)}</p>
          {invoice.label ? <p className="text-center text-sm lg:text-left">{invoice.label}</p> : null}
        </div>
        <div className={`mt-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 ${invoice.status === "expired" ? "opacity-40" : ""}`}>
          <QrImage value={qrValue} label="QR de la facture" className="mx-auto aspect-square w-full max-w-[240px] lg:max-w-[360px]" />
          <p role="status" aria-live="polite" className="mt-4 min-h-6 text-center font-medium">
            {wait.label}
          </p>
        </div>
        <div>
          {clock && waiting ? (
            <p className={`text-center tabular lg:text-left ${clock.urgent ? "text-warning" : "text-muted"}`}>
              {clock.expired ? "00:00" : clock.mmss} · expire à {clock.expiresClock}
            </p>
          ) : null}
          {waiting ? (
            <p className="mt-1 min-h-5 text-center lg:text-left">
              <UpdatedAgo at={query.dataUpdatedAt} />
            </p>
          ) : null}
          {wait.autoSettle ? (
            <p className="mt-3 text-center text-sm text-muted lg:text-left">
              Mode démo : confirmation automatique.
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyInvoice()} disabled={!qrValue}>
              Copier
            </Button>
            <Button type="button" variant="secondary" onClick={() => void shareInvoice()} disabled={!qrValue}>
              Partager
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}
