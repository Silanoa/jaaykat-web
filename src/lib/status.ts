import type { InvoiceStatus } from "./schemas";

export function isPaid(status: string): boolean {
  return status === "paid";
}

export function isTerminalInvoice(status: InvoiceStatus): boolean {
  switch (status) {
    case "paid":
    case "expired":
    case "failed":
      return true;
    case "creating":
    case "pending":
      return false;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "creating":
      return "Création de la facture…";
    case "pending":
      return "En attente du paiement";
    case "paid":
      return "Payé";
    case "expired":
      return "Facture expirée";
    case "failed":
      return "Paiement non abouti";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
