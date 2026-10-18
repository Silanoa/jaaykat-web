import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AmountPad, AmountReadout } from "../components/pads";
import { QrImage } from "../components/qr-image";
import { ShopHeader } from "../components/shell";
import { Button, Page, PageHeader, TextInput } from "../components/ui";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { formatXof } from "../lib/format";
import { chargeCtaLabel } from "../lib/labels";
import { postBlockReason } from "../lib/offline";
import { readQuickAmounts } from "../lib/quick-amounts";
import { pollRetryDelay, shouldRetry } from "../lib/resilience";
import { useSession } from "../stores/session";

export function ChargePage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const merchant = useSession((state) => state.merchant);
  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quick = readQuickAmounts();
  const block = postBlockReason("invoice", online);
  const rates = useQuery({
    queryKey: ["rates"],
    queryFn: () => api.rates(),
    retry: shouldRetry,
    retryDelay: pollRetryDelay,
    enabled: online,
    refetchInterval: online ? 60_000 : false,
  });

  async function createInvoice() {
    if (block || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const invoice = await api.createInvoice(
        { amountXof: amount, ...(label.trim() ? { label: label.trim() } : {}) },
        crypto.randomUUID(),
      );
      navigate(`/app/invoice/${invoice.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "La facture n'a pas pu être créée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = amount <= 0 || Boolean(block) || busy;
  return (
    <Page
      action={
        <div>
          {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button type="button" disabled={disabled} busy={busy} onClick={() => void createInvoice()}>
            {chargeCtaLabel(amount)}
          </Button>
        </div>
      }
    >
      <ShopHeader />
      <PageHeader title="Encaisser" subtitle="Saisissez le montant à encaisser." />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start lg:gap-10">
        <div>
          <AmountReadout value={amount} />
          <div className="min-h-5 text-center text-sm text-muted">
            {rates.data ? <p>Taux indicatif : 1 BTC = {formatXof(rates.data.btcXof)}</p> : null}
          </div>
          {amount === 0 ? (
            <div className="my-3 flex flex-wrap gap-2">
              {quick.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={amount === value}
                  className="min-h-12 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-[var(--shadow-card)]"
                  onClick={() => setAmount(value)}
                >
                  {formatXof(value)}
                </button>
              ))}
            </div>
          ) : null}
          <label className="mb-3 block text-sm font-medium">
            Libellé (optionnel)
            <TextInput className="mt-1" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Coupe + barbe" />
          </label>
          <AmountPad value={amount} onChange={setAmount} />
          <Link to="/app/qr" className="mt-4 inline-flex min-h-12 items-center font-medium text-primary">
            Mon QR permanent
          </Link>
        </div>
        <aside className="mt-6 hidden rounded-2xl border border-black/8 bg-surface p-6 lg:block">
          <h2 className="text-center text-lg font-semibold">QR permanent</h2>
          {merchant?.qrUrl ? (
            <div className="mt-4">
              <p className="mb-3 text-center text-sm font-semibold text-ink">{merchant.displayName}</p>
              <QrImage value={merchant.qrUrl} label="QR permanent" className="mx-auto aspect-square w-full max-w-[360px]" />
              <p className="mt-3 text-center text-xs text-muted">Vérifiez toujours ici, jamais sur une capture d&apos;écran.</p>
            </div>
          ) : (
            <p className="mt-4 text-sm">QR permanent indisponible.</p>
          )}
        </aside>
      </div>
    </Page>
  );
}
