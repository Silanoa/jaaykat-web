import { useState } from "react";
import QRCode from "qrcode";
import { QrImage } from "../components/qr-image";
import { ShopHeader } from "../components/shell";
import { Button, Page } from "../components/ui";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

export function UniversalQrPage() {
  const merchant = useSession((state) => state.merchant);
  const url = merchant?.qrUrl || (merchant ? `${window.location.origin}/p/${merchant.slug}` : "");
  const [busy, setBusy] = useState(false);

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    useToast.getState().show("Lien copié");
  }

  async function share() {
    if (!url) return;
    if (navigator.share) {
      await navigator.share({ title: merchant?.displayName ?? "Jaaykat", url });
      return;
    }
    await copyLink();
  }

  async function download() {
    if (!url) return;
    setBusy(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 512 });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${merchant?.slug ?? "jaaykat"}-affiche.png`;
      anchor.click();
      useToast.getState().show("Affiche téléchargée");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Mon QR permanent"
      action={
        <div className="grid gap-2">
          <Button type="button" onClick={() => void download()} busy={busy} disabled={!url}>
            Télécharger
          </Button>
          <Button type="button" variant="secondary" onClick={() => void share()} disabled={!url}>
            Partager
          </Button>
        </div>
      }
    >
      <ShopHeader />
      <article className="rounded-xl bg-surface p-4 text-center shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold text-primary">Jaaykat</p>
        <h2 className="mt-1 text-xl font-semibold">{merchant?.displayName ?? "Boutique"}</h2>
        <div className="my-4">
          <QrImage value={url || null} label="QR de la page de paiement" />
        </div>
        <p>Scannez pour payer</p>
        <p className="mt-2 break-all text-sm text-muted">{url}</p>
      </article>
      <button type="button" className="mt-4 min-h-12 text-primary" onClick={() => void copyLink()}>
        Copier le lien
      </button>
    </Page>
  );
}
