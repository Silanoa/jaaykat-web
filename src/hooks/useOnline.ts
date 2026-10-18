import { useEffect, useState } from "react";
import { useApi } from "../lib/api-context";

export function useOnline(): boolean {
  const api = useApi();
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [apiOnline, setApiOnline] = useState(true);

  useEffect(() => {
    const goOnline = () => setBrowserOnline(true);
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    let cancelled = false;
    const ping = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setApiOnline(false);
        return;
      }
      try {
        await api.health();
        if (!cancelled) setApiOnline(true);
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    };
    void ping();
    const id = window.setInterval(() => void ping(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [api]);

  return browserOnline && apiOnline;
}
