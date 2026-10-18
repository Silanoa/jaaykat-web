import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { PublicShell } from "../components/shell";
import { ErrorState, Page, Skeleton } from "../components/ui";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { formatWhen } from "../lib/format";
import { pollRetryDelay, shouldRetry } from "../lib/resilience";

export function AttestationPage() {
  const { token = "" } = useParams();
  const api = useApi();
  const query = useQuery({
    queryKey: ["attestation", token],
    queryFn: () => api.attestation(token),
    retry: shouldRetry,
    retryDelay: pollRetryDelay,
  });

  return (
    <PublicShell>
      <Page title="Attestation">
        {query.isLoading ? <Skeleton className="h-32" /> : null}
        {query.isError ? (
          <ErrorState
            message={
              query.error instanceof ApiError && query.error.status === 404
                ? "Attestation introuvable, expirée ou révoquée."
                : query.error instanceof ApiError
                  ? query.error.message
                  : "Lecture impossible."
            }
          />
        ) : null}
        {query.data ? (
          <article className="rounded-xl bg-surface p-4">
            <p className="text-sm text-muted">
              {query.data.status === "valid"
                ? "Lien valide"
                : query.data.status === "expired"
                  ? "Lien expiré"
                  : "Lien révoqué"}
            </p>
            <h2 className="mt-2 text-xl font-semibold">{query.data.shopName}</h2>
            <p className="tabular mt-3 text-[40px] leading-[48px] font-bold">{query.data.score ?? "—"}</p>
            <p>Bande {query.data.band ?? "—"}</p>
            <p className="mt-2 text-sm">{query.data.period}</p>
            <p className="text-sm">{query.data.salesCount} ventes</p>
            <p className="text-sm text-muted">Calculé {formatWhen(query.data.computedAt)}</p>
            <p className="text-sm text-muted">Lien jusqu'au {formatWhen(query.data.expiresAt)}</p>
            <p className="mt-4 text-sm">
              Calculé à partir de paiements Lightning via l'API Bitnob. Indicatif, aucun montant détaillé, aucun client.
            </p>
          </article>
        ) : null}
      </Page>
    </PublicShell>
  );
}
