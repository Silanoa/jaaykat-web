import { useState } from "react";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { useToast } from "../stores/toast";

export function useShareAttestation() {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.shareScore();
      setUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        useToast.getState().show("Lien d'attestation copié");
      } catch {
        useToast.getState().show("Attestation émise");
      }
    } catch (caught) {
      setUrl(null);
      setError(caught instanceof ApiError ? caught.message : "L'attestation n'a pas pu être émise. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return { url, busy, error, share };
}
