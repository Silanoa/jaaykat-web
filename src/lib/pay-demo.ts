import { payMethodLabel } from "./labels";
import type { InvoiceStatus, PayMethod } from "./schemas";
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
  payMethod: PayMethod | null;
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

export interface PayChoice {
  method: PayMethod;
  label: string;
  hint: string;
}

export function payChoices(): PayChoice[] {
  const methods: PayMethod[] = ["lightning", "wave", "orange", "free", "expresso"];
  return methods.map((method) => ({
    method,
    label: payMethodLabel(method),
    hint: method === "lightning" ? "Application Lightning de l'acheteur" : "Mobile money",
  }));
}

export function lightningUri(bolt11: string): string {
  return `lightning:${bolt11.replace(/^lightning:/i, "")}`;
}

export type StepState = "done" | "current" | "todo" | "failed";

export interface PayStep {
  key: "sent" | "confirming" | "received";
  label: string;
  state: StepState;
}

export function payProgress(input: { status: InvoiceStatus; payMethod: PayMethod | null }): PayStep[] {
  const sent = input.payMethod !== null;
  let states: [StepState, StepState, StepState];
  switch (input.status) {
    case "paid":
      states = ["done", "done", "done"];
      break;
    case "expired":
    case "failed":
      states = [sent ? "done" : "todo", "failed", "todo"];
      break;
    case "creating":
    case "pending":
      states = sent ? ["done", "current", "todo"] : ["current", "todo", "todo"];
      break;
    default: {
      const unreachable: never = input.status;
      return unreachable;
    }
  }
  return [
    { key: "sent", label: "Envoi", state: states[0] },
    { key: "confirming", label: "Confirmation", state: states[1] },
    { key: "received", label: "Reçu", state: states[2] },
  ];
}

export function updatedAgo(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 10) return "mis à jour à l'instant";
  if (seconds < 60) return `mis à jour il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `mis à jour il y a ${minutes} min`;
  return "mis à jour il y a plus d'une heure";
}
