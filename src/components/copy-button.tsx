import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "../stores/toast";

export function CopyButton({
  value,
  label,
  children,
  className = "",
}: {
  value: string;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      useToast.getState().show("Copie impossible");
      return;
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      aria-label={children ? undefined : label}
      onClick={() => void copy()}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary ${className}`}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      {children ? <span>{copied ? "Copié" : children}</span> : null}
      <span role="status" className="sr-only">
        {copied ? "Copié" : ""}
      </span>
    </button>
  );
}
