import type { InvoiceStatus, PayMethod, PayoutNetwork, PayoutStatus } from "./schemas";
import { CATEGORIES } from "./validation";

export function categoryLabel(value: string): string {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function channelLabel(channel: "dynamic" | "static_qr"): string {
  switch (channel) {
    case "dynamic":
      return "Comptoir";
    case "static_qr":
      return "QR permanent";
    default: {
      const unreachable: never = channel;
      return unreachable;
    }
  }
}

export function networkLabel(network: PayoutNetwork): string {
  switch (network) {
    case "wave":
      return "Wave";
    case "orange":
      return "Orange Money";
    case "free":
      return "Yas";
    case "expresso":
      return "Expresso";
    default: {
      const unreachable: never = network;
      return unreachable;
    }
  }
}

export function payMethodLabel(method: PayMethod): string {
  if (method === "lightning") return "Portefeuille Lightning";
  return method === "yas" ? "Yas" : networkLabel(method);
}

export function payWithLabel(method: PayMethod): string {
  return method === "lightning" ? "votre portefeuille Lightning" : payMethodLabel(method);
}

export function invoiceBadge(status: InvoiceStatus): string {
  switch (status) {
    case "creating":
      return "Création";
    case "pending":
      return "En attente";
    case "paid":
      return "Payée";
    case "expired":
      return "Expirée";
    case "failed":
      return "Échec";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function payoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case "quoted":
      return "Devis";
    case "initiated":
      return "Demandé";
    case "processing":
      return "En cours";
    case "completed":
      return "Envoyé";
    case "failed":
      return "Échoué";
    case "expired":
      return "Expiré";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function shortProof(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

export function formatDelta(ratio: number | null): string | null {
  if (ratio === null || Number.isNaN(ratio)) return null;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return "stable";
  return pct > 0 ? `+${pct} %` : `${pct} %`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || Number.isNaN(ratio)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}
