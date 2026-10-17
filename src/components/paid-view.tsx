import type { ReactNode } from "react";
import { formatSats, formatWhen, formatXof } from "../lib/format";
import { CopyButton } from "./copy-button";

function displayProof(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}\u2026${value.slice(-6)}` : value;
}

export function CheckBadge() {
  return (
    <span className="jk-check-circle grid size-24 place-items-center rounded-full bg-success-bg" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-12 text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path className="jk-check-path" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

export interface PaidViewProps {
  title: string;
  amountXof: number;
  amountSats?: number | null;
  paidAt?: string | null;
  subject?: string | null;
  subjectLabel?: string;
  proof: { kind: "Preuve" | "Référence"; value: string };
  primary: ReactNode;
  secondary?: ReactNode;
}

export function PaidView({ title, amountXof, amountSats, paidAt, subject, subjectLabel = "Boutique", proof, primary, secondary }: PaidViewProps) {
  return (
    <section className="jk-fade-in flex min-h-0 flex-1 flex-col items-center px-6 pt-8 pb-6 text-center" aria-live="polite">
      <div className="my-auto flex w-full max-w-sm flex-col items-center">
        <CheckBadge />
        <h1 className="mt-6 text-lg font-semibold text-primary">{title}</h1>
        <p className="tabular mt-2 text-[44px] leading-[52px] font-bold tracking-tight">{formatXof(amountXof)}</p>
        {amountSats ? <p className="tabular mt-1 text-sm text-subtle">{formatSats(amountSats)}</p> : null}
        <dl className="mt-8 w-full divide-y divide-black/10 rounded-2xl bg-surface text-left text-sm shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
          {subject ? (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted">{subjectLabel}</dt>
              <dd className="truncate font-medium">{subject}</dd>
            </div>
          ) : null}
          {paidAt ? (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted">Date</dt>
              <dd className="font-medium">{formatWhen(paidAt)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-4">
            <dt className="text-muted">{proof.kind}</dt>
            <dd className="flex items-center gap-1 font-medium tabular">
              {displayProof(proof.value)}
              <CopyButton value={proof.value} label={`Copier la ${proof.kind === "Preuve" ? "preuve" : "référence"}`} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-8 grid w-full max-w-sm gap-2">
        {primary}
        {secondary}
      </div>
      <p className="mt-6 text-xs text-subtle">Démo · sandbox</p>
    </section>
  );
}
