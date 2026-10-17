import type { InvoiceStatus, PayoutNetwork } from "./schemas";
import { invoiceStatusLabel } from "./status";

export function invoiceQrPayload(invoice: { payUrl?: string | null; bolt11: string | null }): string | null {
  if (invoice.payUrl) return invoice.payUrl;
  return invoice.bolt11;
}

export function merchantWaitCopy(invoice: { status: InvoiceStatus; payUrl?: string | null }): {
  label: string;
  autoSettle: boolean;
} {
  const manual = Boolean(invoice.payUrl);
  const waiting = invoice.status === "pending" || invoice.status === "creating";
  if (manual && waiting) return { label: "En attente du client", autoSettle: false };
  return { label: invoiceStatusLabel(invoice.status), autoSettle: !manual && waiting };
}

export type PublicPayPhase = "choose" | "waiting" | "paid" | "expired" | "failed";

export function publicPayPhase(input: {
  status: InvoiceStatus;
  demoPayment: boolean;
  payMethod: PayoutNetwork | null;
}): PublicPayPhase {
  switch (input.status) {
    case "paid":
      return "paid";
    case "expired":
      return "expired";
    case "failed":
      return "failed";
    case "creating":
      return "waiting";
    case "pending":
      if (input.demoPayment && input.payMethod === null) return "choose";
      return "waiting";
    default: {
      const unreachable: never = input.status;
      return unreachable;
    }
  }
}
