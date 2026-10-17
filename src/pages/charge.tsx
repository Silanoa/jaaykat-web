import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AmountPad, AmountReadout } from "../components/pads";
import { QrImage } from "../components/qr-image";
import { ShopHeader } from "../components/shell";
import { Button, Page } from "../components/ui";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { formatXof } from "../lib/format";
import { postBlockReason } from "../lib/offline";
import { readQuickAmounts } from "../lib/quick-amounts";
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

  const disabled = amount <= 0 || Boolean(block) || rates.isError || busy;

  return (
    <Page
      action={
        <div>
          {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
          {rates.isError ? (
            <p className="mb-2 text-sm text-danger">
              Taux indisponible.{" "}
              <button type="button" className="underline" onClick={() => void rates.refetch()}>
                Réessayer
              </button>
            </p>
          ) : null}
          {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
          <Button type="button" disabled={disabled} busy={busy} onClick={() => void createInvoice()}>
            Générer le QR
          </Button>
        </div>
      }
    >
      <ShopHeader />
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div>
      <h1 className="mb-2 text-[28px] leading-[34px] font-bold">Encaisser</h1>
      <AmountReadout value={amount} />
      <div className="min-h-5 text-center text-sm text-muted">
      {rates.data ? (
        <p>
          Taux indicatif : 1 BTC = {formatXof(rates.data.btcXof)}
        </p>
      ) : null}
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        {quick.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={amount === value}
            className={`min-h-12 rounded-full px-4 text-sm font-semibold ${amount === value ? "bg-primary text-white" : "bg-surface text-ink"}`}
            onClick={() => setAmount(value)}
          >
            {formatXof(value)}
          </button>
        ))}
      </div>
      <label className="mb-3 block text-sm">
        Libellé (optionnel)
        <input
          className="mt-1 min-h-12 w-full rounded-lg border border-black/15 bg-surface px-3"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <AmountPad value={amount} onChange={setAmount} />
      <Link to="/app/qr" className="mt-4 inline-flex min-h-12 items-center text-primary">
        Mon QR permanent{merchant ? "" : ""}
      </Link>
      </div>
      <aside className="mt-6 hidden rounded-2xl bg-surface p-6 lg:block">
        <h2 className="text-lg font-semibold">QR permanent</h2>
        <p className="mt-1 text-sm text-muted">
          Ce QR ouvre la page client. Après « Générer le QR », le QR de la vente et son statut s'affichent en grand à droite.
        </p>
        {merchant?.qrUrl ? (
          <div className="mt-4">
            <QrImage value={merchant.qrUrl} label="QR permanent" className="mx-auto aspect-square w-full max-w-[360px]" />
          </div>
        ) : (
          <p className="mt-4 text-sm">Aucun QR permanent renvoyé par le compte.</p>
        )}
      </aside>
      </div>
    </Page>
  );
}
