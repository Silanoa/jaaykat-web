import { Wallet } from "lucide-react";
import { lightningUri } from "../lib/pay-demo";
import { CopyButton } from "./copy-button";
import { QrImage } from "./qr-image";

export function LightningPanel({ bolt11, note }: { bolt11: string; note: string }) {
  return (
    <div className="flex flex-col items-center">
      <QrImage value={bolt11} label="QR de la facture Lightning" className="mx-auto size-[220px] rounded-2xl shadow-[0_1px_2px_rgba(17,24,39,0.08)]" />
      <div className="mt-3 flex w-full max-w-sm flex-col gap-2">
        <a
          href={lightningUri(bolt11)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white active:bg-primary-strong"
        >
          <Wallet aria-hidden="true" size={18} />
          Ouvrir mon portefeuille
        </a>
        <CopyButton value={bolt11} label="Copier la facture Lightning" className="border border-black/10 bg-surface">
          Copier la facture
        </CopyButton>
      </div>
      <p className="mt-3 max-w-sm text-center text-xs text-subtle">{note}</p>
    </div>
  );
}
