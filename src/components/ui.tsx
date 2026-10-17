import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-white active:bg-primary-strong disabled:bg-primary/40",
  secondary: "bg-surface text-ink border border-black/10 active:bg-bg",
  ghost: "bg-transparent text-primary",
  danger: "bg-danger text-white",
};

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
        {title ? <h1 className="mb-4 text-[28px] leading-[34px] font-bold">{title}</h1> : null}
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
    <div className="rounded-xl bg-surface px-4 py-8 text-center shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
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
