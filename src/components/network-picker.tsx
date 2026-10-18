import { Check } from "lucide-react";
import { networkLabel, networkLogoMethod } from "../lib/labels";
import type { PayoutNetwork } from "../lib/schemas";
import { PayLogo } from "./pay-logo";

export const PAYOUT_NETWORKS: PayoutNetwork[] = ["wave", "orange", "free", "expresso"];

export function NetworkPicker({ value, onChange }: { value: PayoutNetwork; onChange: (network: PayoutNetwork) => void }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-2 text-sm font-medium">Réseau</legend>
      <div className="grid grid-cols-2 gap-2">
        {PAYOUT_NETWORKS.map((item) => {
          const selected = value === item;
          return (
            <label
              key={item}
              data-selected={selected}
              className={`relative flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 ${
                selected ? "border-primary bg-success-bg" : "border-black/10 bg-surface"
              }`}
            >
              <input
                type="radio"
                name="network"
                className="sr-only"
                aria-label={networkLabel(item)}
                checked={selected}
                onChange={() => onChange(item)}
              />
              <PayLogo method={networkLogoMethod(item)} />
              <span className={`text-sm font-semibold ${selected ? "text-primary-strong" : ""}`}>{networkLabel(item)}</span>
              {selected ? (
                <span aria-hidden="true" className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
