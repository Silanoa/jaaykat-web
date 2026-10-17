import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QrImage } from "../components/qr-image";
import { BackButton } from "../components/shell";
import { Button, ErrorState, Page, Skeleton } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { beep, celebratePayment, vibratePayment } from "../lib/celebrate";
import { countdown, formatSats, formatWhen, formatXof } from "../lib/format";
import { shortProof } from "../lib/labels";
import { postBlockReason } from "../lib/offline";
import { invoiceQrPayload, merchantWaitCopy } from "../lib/pay-demo";
import { isTerminalInvoice } from "../lib/status";
import { useToast } from "../stores/toast";

const seenPayments = new Set<string>();

export function InvoicePage() {
  const { id = "" } = useParams();
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const now = useNow();
  const block = postBlockReason("invoice", online);
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id),
    refetchInterval: (state) => {
      const status = state.state.data?.status;
      if (!status || isTerminalInvoice(status)) return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (query.data?.status !== "paid") return;
    celebratePayment(query.data.id, seenPayments, { beep, vibrate: vibratePayment });
  }, [query.data?.id, query.data?.status]);

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
      <Page title="Facture">
        <p>Création de la facture…</p>
        <Skeleton className="mx-auto mt-4 size-[240px]" />
      </Page>
    );
  }

  if (query.isError || !query.data) {
    const message = query.error instanceof ApiError ? query.error.message : "La facture est introuvable.";
    return (
      <Page title="Facture">
        <ErrorState message={message} onRetry={() => void query.refetch()} />
      </Page>
    );
  }

  const invoice = query.data;
  const qrValue = invoiceQrPayload(invoice);
  const wait = merchantWaitCopy(invoice);
  if (invoice.status === "paid") {
    const proof = invoice.paymentHash ? shortProof(invoice.paymentHash) : shortProof(invoice.id);
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-primary px-4 py-8 text-white">
        <p className="text-sm">Paiement simulé · sandbox</p>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="grid size-20 place-items-center rounded-full bg-white text-4xl text-primary" aria-hidden="true">
            ✓
          </p>
          <h1 className="mt-4 text-[40px] leading-[48px] font-bold">Payé</h1>
          <p className="tabular mt-2 text-[40px] leading-[48px] font-bold">{formatXof(invoice.amountXof)}</p>
          <p className="mt-2">{formatSats(invoice.amountSats)}</p>
          {invoice.paidAt ? <p className="mt-2">{formatWhen(invoice.paidAt)}</p> : null}
          {invoice.label ? <p className="mt-1">{invoice.label}</p> : null}
          <p className="mt-4 text-sm">
            {invoice.paymentHash ? "Preuve" : "Référence"} : {proof}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate("/app/charge")}>
          Nouvelle vente
        </Button>
        <button type="button" className="mt-3 min-h-12 text-white" onClick={() => navigate(`/app/sales?vente=${invoice.id}`)}>
          Voir la vente
        </button>
      </div>
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
      <p className="tabular text-center text-[32px] leading-10 font-bold">{formatXof(invoice.amountXof)}</p>
      <p className="text-center text-sm text-muted">{formatSats(invoice.amountSats)}</p>
      {invoice.label ? <p className="text-center text-sm">{invoice.label}</p> : null}
      <div className={`mt-4 ${invoice.status === "expired" ? "opacity-40" : ""}`}>
        <QrImage value={qrValue} label="QR de la facture" />
      </div>
      <p className="mt-4 text-center font-medium">{wait.label}</p>
      {clock && waiting ? (
        <p className={`text-center tabular ${clock.urgent ? "text-warning" : "text-muted"}`}>
          {clock.expired ? "00:00" : clock.mmss} · expire à {clock.expiresClock}
        </p>
      ) : null}
      {query.isFetching && waiting ? <p className="text-center text-sm text-muted">Vérification…</p> : null}
      {wait.autoSettle ? <p className="mt-3 text-center text-sm">Confirmation automatique en ~5 s.</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => void copyInvoice()} disabled={!qrValue}>
          Copier
        </Button>
        <Button type="button" variant="secondary" onClick={() => void shareInvoice()} disabled={!qrValue}>
          Partager
        </Button>
      </div>
    </Page>
  );
}
