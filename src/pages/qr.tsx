import { useState } from "react";
import QRCode from "qrcode";
import { QrImage } from "../components/qr-image";
import { BrandMark } from "../components/brand-mark";
import { ShopHeader } from "../components/shell";
import { Button, Card, Page, PageHeader } from "../components/ui";
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
      <PageHeader title="Mon QR permanent" subtitle="Affichez-le à la caisse ou sur votre devanture." />
      <Card className="text-center">
        <div className="flex items-center justify-center gap-2">
          <BrandMark size={28} />
          <p className="text-sm font-semibold text-primary">JaayKat</p>
        </div>
        <h2 className="mt-2 text-xl font-semibold">{merchant?.displayName ?? "Boutique"}</h2>
        <div className="my-4">
          <QrImage value={url || null} label="QR de la page de paiement" />
        </div>
        <p className="font-medium">Scannez pour payer</p>
        <p className="mt-2 text-xs text-muted">Vérifiez toujours ici, jamais sur une capture d&apos;écran.</p>
        <p className="mt-2 break-all text-sm text-muted">{url}</p>
      </Card>
      <button type="button" className="mt-4 min-h-12 font-medium text-primary" onClick={() => void copyLink()}>
        Copier le lien
      </button>
    </Page>
  );
}
