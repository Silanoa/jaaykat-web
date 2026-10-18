import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  busy?: boolean;
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-navy text-white active:bg-navy-strong disabled:bg-navy/40",
  accent: "bg-primary text-white active:bg-primary-strong disabled:bg-primary/40",
  secondary: "bg-surface text-ink border border-border active:bg-bg",
  ghost: "bg-transparent text-primary",
  danger: "bg-danger text-white",
};

export const inputClass =
  "min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary";

export function Button({ variant = "primary", busy = false, className = "", children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 text-base font-semibold disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          Veuillez patienter…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function PhoneField({
  id,
  value,
  onChange,
  error,
  label = "Téléphone",
  hint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="flex gap-2">
        <span className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium">
          <span aria-hidden="true">🇸🇳</span>
          +221
        </span>
        <input
          id={id}
          className={inputClass}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="70 123 24 25"
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-black/8 bg-surface p-4 shadow-[var(--shadow-card)] ${className}`}>{children}</div>;
}

export function Banner({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "danger" | "info" | "success";
  children: ReactNode;
}) {
  const tones = {
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
    info: "bg-info-bg text-info",
    success: "bg-success-bg text-success",
  } as const;
  return (
    <p role="status" className={`rounded-xl px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-primary/40 bg-brand-soft p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${active ? "border border-primary bg-surface text-primary" : "text-muted"}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-3">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-[34px] font-semibold text-ink lg:text-[32px] lg:leading-[38px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}

export function Page({
  title,
  children,
  action,
  actionClassName = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  actionClassName?: string;
}) {
  return (
    <div className="jk-fade-in flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-4 lg:overflow-visible lg:px-8">
        {title ? <h1 className="font-display mb-4 text-[28px] leading-[34px] font-semibold">{title}</h1> : null}
        {children}
      </div>
      {action ? (
        <div data-fixed className={`sticky bottom-0 bg-bg px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:px-8 ${actionClassName}`}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/10 ${className}`} />;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/8 bg-surface px-4 py-8 text-center shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-danger-bg px-4 py-6 text-center" role="alert">
      <h2 className="text-lg font-semibold text-danger">Impossible de charger</h2>
      <p className="mt-2 text-ink">{message}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button type="button" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ToastHost() {
  return null;
}
