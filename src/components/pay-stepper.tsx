import { Check, X } from "lucide-react";
import type { PayStep, StepState } from "../lib/pay-demo";

const STATE_TEXT: Record<StepState, string> = {
  done: "terminé",
  current: "en cours",
  todo: "à venir",
  failed: "échec",
};

export function PayStepper({ steps }: { steps: PayStep[] }) {
  return (
    <ol className="flex w-full items-start" aria-label="Progression du paiement">
      {steps.map((step, index) => {
        const previous = steps[index - 1];
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {previous ? (
              <span
                aria-hidden="true"
                className={`absolute top-4 left-[-50%] h-0.5 w-full -translate-y-1/2 transition-colors duration-300 ${previous.state === "done" ? "bg-primary" : "bg-black/10"}`}
              />
            ) : null}
            <span
              className={`relative z-10 grid size-8 place-items-center rounded-full border-2 text-sm font-semibold transition-colors duration-300 ${
                step.state === "done"
                  ? "border-primary bg-primary text-white"
                  : step.state === "current"
                    ? "border-primary bg-surface text-primary"
                    : step.state === "failed"
                      ? "border-danger bg-danger text-white"
                      : "border-black/15 bg-surface text-subtle"
              }`}
            >
              {step.state === "done" ? (
                <Check aria-hidden="true" size={16} strokeWidth={3} />
              ) : step.state === "failed" ? (
                <X aria-hidden="true" size={16} strokeWidth={3} />
              ) : step.state === "current" ? (
                <span className="size-2.5 animate-pulse rounded-full bg-primary" />
              ) : (
                index + 1
              )}
            </span>
            <span className={`text-sm ${step.state === "todo" ? "text-subtle" : "font-medium text-ink"}`}>
              {step.label}
              <span className="sr-only">, {STATE_TEXT[step.state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
