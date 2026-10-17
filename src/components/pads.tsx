import { Delete } from "lucide-react";
import { useRef } from "react";
import { applyAmountKey } from "../lib/amount";
import { formatXof } from "../lib/format";

export function AmountPad({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const hold = useRef<number | null>(null);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === "back" ? "Effacer" : key}
          className="min-h-12 rounded-xl bg-surface text-xl font-semibold tabular shadow-[0_1px_2px_rgba(17,24,39,0.08)] active:bg-bg"
          onPointerDown={() => {
            if (key !== "back") return;
            hold.current = window.setTimeout(() => onChange(0), 500);
          }}
          onPointerUp={() => {
            if (hold.current) window.clearTimeout(hold.current);
            hold.current = null;
          }}
          onPointerLeave={() => {
            if (hold.current) window.clearTimeout(hold.current);
            hold.current = null;
          }}
          onClick={() => onChange(applyAmountKey(value, key === "back" ? "back" : key))}
        >
          {key === "back" ? <Delete className="mx-auto" aria-hidden="true" /> : key}
        </button>
      ))}
    </div>
  );
}

export function AmountReadout({ value }: { value: number }) {
  return (
    <p className="tabular text-center text-[40px] leading-[48px] font-bold" aria-live="polite">
      {formatXof(value)}
    </p>
  );
}

export function PinPad({
  value,
  onChange,
  disabled = false,
  shake = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  shake?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <div>
      <div className={`mb-4 flex justify-center gap-3 ${shake ? "shake" : ""}`} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={`size-3 rounded-full border border-ink ${index < value.length ? "bg-ink" : "bg-transparent"}`}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {value.length} chiffres sur 6
      </p>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, index) =>
          key === "" ? (
            <span key={`empty-${index}`} />
          ) : (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-label={key === "back" ? "Effacer" : key}
              className="min-h-12 rounded-xl bg-surface text-xl font-semibold disabled:opacity-40"
              onClick={() => {
                if (key === "back") onChange(value.slice(0, -1));
                else if (value.length < 6) onChange(value + key);
              }}
            >
              {key === "back" ? <Delete className="mx-auto" aria-hidden="true" /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
