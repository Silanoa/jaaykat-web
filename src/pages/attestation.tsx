import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CopyButton } from "../components/copy-button";
import { QrImage } from "../components/qr-image";
import { PublicShell } from "../components/shell";
import { ErrorState, Page, Skeleton } from "../components/ui";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { formatDate, formatDay, formatXof } from "../lib/format";
import { pollRetryDelay, shouldRetry } from "../lib/resilience";
import type { Attestation } from "../lib/schemas";

function environmentNote(environment: string): string | null {
  if (environment === "live" || environment === "production") return null;
  if (environment === "sandbox") {
    return "Mode démo : paiements de test, aucun argent réel.";
  }
  if (environment === "mock") {
    return "Mode démo : paiements simulés, aucun argent réel.";
  }
  if (environment === "unknown") {
    return "Environnement non vérifié : ne pas supposer que ces paiements sont réels.";
  }
  return "Environnement de test : aucun argent réel.";
}

function statusLine(data: Attestation): string {
  if (data.status === "valid") return `Attestation valide jusqu'au ${formatDate(data.expiresAt)}`;
  if (data.status === "expired") return `Attestation expirée le ${formatDate(data.expiresAt)}`;
  return "Cette attestation a été révoquée. Elle n'est plus valable.";
}

function Details({ data }: { data: Attestation }) {
  const note = environmentNote(data.environment);
  const count = data.salesCount ?? 0;
  return (
    <>
      {data.demo ? (
        <p className="mt-3 rounded-xl bg-warning-bg px-3 py-2 text-sm font-medium text-warning">
          Démo : historique de ventes simulé, sans valeur réelle.
        </p>
      ) : null}
      {note ? <p className="mt-3 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">{note}</p> : null}
      <article className="mt-3 rounded-xl bg-surface p-4 shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
        <h2 className="text-xl font-semibold">{data.shopName}</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Période</dt>
          <dd className="text-right">
            du {data.period ? formatDay(data.period.from) : "—"} au {data.period ? formatDay(data.period.to) : "—"}
          </dd>
          <dt className="text-muted">Ventes payées</dt>
          <dd className="tabular text-right">{count}</dd>
          <dt className="text-muted">Montant total</dt>
          <dd className="tabular text-right">{formatXof(data.totalXof ?? 0)}</dd>
          <dt className="text-muted">Émise le</dt>
          <dd className="text-right">{formatDate(data.issuedAt)}</dd>
          <dt className="text-muted">Identifiant</dt>
          <dd className="tabular text-right font-medium">{data.attestationId}</dd>
        </dl>
        <p className="tabular mt-4 text-[40px] leading-[48px] font-bold">
          {data.score ?? "—"} <span className="text-xl font-semibold text-muted">/ 100</span>
        </p>
        <p className="font-semibold">Bande {data.band ?? "—"}</p>
        <p className="mt-2 text-sm text-muted">
          Régularité des encaissements sur les {data.windowDays} derniers jours. Ni note de solvabilité, ni garantie de crédit.
        </p>
      </article>
      <section aria-label="Ce que cette attestation atteste" className="mt-4">
        <h2 className="font-semibold">Ce que cette attestation atteste</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.demo ? (
            <li>Rien de réel : historique de ventes simulé.</li>
          ) : (
            <li>
              Que {count} paiement{count > 1 ? "s" : ""} Lightning {count > 1 ? "ont" : "a"} été enregistré{count > 1 ? "s" : ""} comme
              payé{count > 1 ? "s" : ""} par Jaaykat, après confirmation de Bitnob, sur ce compte de boutique.
            </li>
          )}
          <li>Un score calculé à la date d'émission.</li>
        </ul>
      </section>
      <section aria-label="Ce qu'elle n'atteste pas" className="mt-4">
        <h2 className="font-semibold">Ce qu'elle n'atteste pas</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li>L'identité du commerçant : le compte est ouvert sans vérification.</li>
          <li>Sa solvabilité. Ce n'est pas une garantie de crédit.</li>
          <li>Les ventes payées en espèces ou en dehors de Jaaykat.</li>
        </ul>
      </section>
      <section aria-label="Règles de calcul" className="mt-4">
        <h2 className="font-semibold">Règles de calcul</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">
          <li>Seules les ventes payées comptent. Les factures en attente ne sont pas des ventes.</li>
          <li>
            Fenêtre de {data.windowDays} jours. Sans 14 jours depuis la première vente payée et 20 ventes payées, aucune attestation n'est
            émise.
          </li>
          <li>Pondération : régularité 40 %, croissance 30 %, volume 10 %, fidélité 10 %, qualité d'encaissement 10 %.</li>
          <li>Bande A à partir de 75, B de 60 à 74, C de 45 à 59, D en dessous de 45.</li>
        </ul>
      </section>
      <section aria-label="Vérification" className="mt-4 rounded-xl bg-surface p-4">
        <h2 className="font-semibold">Vérifier en ligne</h2>
        <p className="mt-1 text-sm text-muted">
          Scannez pour vérifier que l'attestation est valable.
        </p>
        <QrImage
          value={window.location.href}
          label="QR code de vérification de cette attestation"
          className="mx-auto mt-3 aspect-square w-full max-w-[200px]"
        />
        <div className="mt-2 flex justify-center">
          <CopyButton value={window.location.href} label="Copier le lien de vérification">
            Copier le lien
          </CopyButton>
        </div>
      </section>
    </>
  );
}

export function AttestationPage() {
  const { token = "" } = useParams();
  const api = useApi();
  const query = useQuery({
    queryKey: ["attestation", token],
    queryFn: () => api.attestation(token),
    retry: shouldRetry,
    retryDelay: pollRetryDelay,
  });
  const data = query.data;

  return (
    <PublicShell>
      <Page title="Attestation de régularité">
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
        {data ? (
          <>
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-sm font-medium ${data.status === "valid" ? "bg-success-bg text-primary-strong" : "bg-danger-bg text-danger"}`}
            >
              {statusLine(data)}
            </p>
            {data.status === "revoked" ? (
              <p className="mt-3 text-sm text-muted">
                {data.shopName} · {data.attestationId}
              </p>
            ) : (
              <Details data={data} />
            )}
          </>
        ) : null}
      </Page>
    </PublicShell>
  );
}
