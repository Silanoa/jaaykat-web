import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api";
import { PERSISTENT_FAILURE_MS, isTransientError, payRetryDelay } from "../lib/resilience";
import type { PayMethod, PublicInvoice } from "../lib/schemas";

type Options = {
  send: (method: PayMethod) => Promise<PublicInvoice>;
  onAccepted: (result: PublicInvoice) => void;
  onConflict: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function usePayStart(options: Options) {
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (chosen: PayMethod): Promise<boolean> => {
    const startedAt = Date.now();
    for (let attempt = 0; alive.current; attempt++) {
      try {
        const result = await latest.current.send(chosen);
        if (alive.current) latest.current.onAccepted(result);
        return true;
      } catch (caught) {
        if (!alive.current) return true;
        if (caught instanceof ApiError && caught.status === 409) {
          latest.current.onConflict();
          return true;
        }
        if (!isTransientError(caught)) {
          setMethod(null);
          setError(caught instanceof ApiError ? caught.message : "Le paiement n'a pas démarré. Réessayez.");
          return false;
        }
        if (Date.now() - startedAt >= PERSISTENT_FAILURE_MS) {
          setFailed(true);
          return false;
        }
        await sleep(payRetryDelay(attempt));
      }
    }
    return true;
  }, []);

  const start = useCallback(
    (chosen: PayMethod) => {
      if (locked.current) return;
      locked.current = true;
      setMethod(chosen);
      setFailed(false);
      setError(null);
      void run(chosen).then((accepted) => {
        if (!accepted) locked.current = false;
      });
    },
    [run],
  );

  const retry = useCallback(() => {
    if (method) start(method);
  }, [method, start]);

  return { method, failed, error, start, retry };
}
