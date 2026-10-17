import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Heatmap } from "../components/heatmap";
import { ScoreGauge } from "../components/score-gauge";
import { ShopHeader } from "../components/shell";
import { Button, EmptyState, ErrorState, Page, Skeleton } from "../components/ui";
import { useDesktop } from "../hooks/useDesktop";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { formatSats, formatWhen, formatXof } from "../lib/format";
import { channelLabel, formatDelta, formatPercent, invoiceBadge, shortProof } from "../lib/labels";
import { screenState } from "../lib/offline";
import { rangeBounds, type RangeKey } from "../lib/ranges";
import type { SaleItem } from "../lib/schemas";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

const COMPONENT_COPY = {
  regularity: { label: "Régularité", weight: "40 %", help: "Jours avec au moins une vente, et stabilité d'une semaine à l'autre." },
  growth: { label: "Croissance", weight: "30 %", help: "Évolution du chiffre des 30 derniers jours par rapport aux 30 précédents." },
  volume: { label: "Volume", weight: "10 %", help: "Niveau du chiffre d'affaires des 30 derniers jours." },
  loyalty: { label: "Fidélité", weight: "10 %", help: "Part du chiffre réalisée par les clients qui reviennent." },
  quality: { label: "Qualité d'encaissement", weight: "10 %", help: "Part des factures payées parmi les factures payées ou expirées." },
} as const;

function stampCache() {
  if (navigator.onLine) useSession.getState().setCachedAt(new Date().toISOString());
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Réessayez dans un instant.";
}

export function SalesPage() {
  const api = useApi();
  const online = useOnline();
  const [params, setParams] = useSearchParams();
  const range = (params.get("range") as RangeKey | null) ?? "today";
  const openId = params.get("vente");
  const bounds = rangeBounds(range);
  const query = useQuery({
    queryKey: ["sales", bounds.from, bounds.to],
    queryFn: async () => {
      const sales = await api.sales(bounds.from, bounds.to);
      stampCache();
      return sales;
    },
  });
  const items = query.data?.items ?? [];
  const state = screenState({
    online,
    loading: query.isLoading,
    error: query.isError,
    empty: items.length === 0,
    hasData: Boolean(query.data),
  });
  const selected = items.find((item) => item.id === openId) ?? null;
  const total = items.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amountXof, 0);

  return (
    <Page title="Ventes">
      <ShopHeader />
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(["today", "7d", "30d"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={range === key}
            className={`min-h-12 rounded-full text-sm font-semibold ${range === key ? "bg-primary text-white" : "bg-surface"}`}
            onClick={() => setParams({ range: key })}
          >
            {key === "today" ? "Aujourd'hui" : key === "7d" ? "7 j" : "30 j"}
          </button>
        ))}
      </div>
      {state === "loading" ? <Skeleton className="h-24" /> : null}
      {state === "offline" ? <ErrorState message="Hors ligne : aucune vente en cache." /> : null}
      {state === "error" ? <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} /> : null}
      {state === "empty" ? (
        <EmptyState
          title="Aucune vente"
          text="Votre première vente apparaîtra ici"
          action={
            <Link to="/app/charge" className="inline-flex min-h-12 items-center font-semibold text-primary">
              Encaisser
            </Link>
          }
        />
      ) : null}
      {state === "ready" ? (
        <div>
          <p className="tabular mb-3 text-lg font-semibold">Total payé {formatXof(total)}</p>
          <div className="lg:hidden">
            <SaleGroups items={items} onOpen={(id) => setParams({ range, vente: id })} />
          </div>
          <SalesTable items={items} onOpen={(id) => setParams({ range, vente: id })} />
        </div>
      ) : null}
      {selected ? (
        <SaleSheet item={selected} onClose={() => setParams({ range })} />
      ) : null}
    </Page>
  );
}

function SaleGroups({ items, onOpen }: { items: SaleItem[]; onOpen: (id: string) => void }) {
  const groups = new Map<string, SaleItem[]>();
  for (const item of items) {
    const when = item.paidAt ?? item.createdAt;
    const key = formatWhen(when).split(",")[0] ?? when;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([day, rows]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold text-muted">{day}</h2>
          <ul className="flex flex-col gap-2">
            {rows.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpen(item.id)} className="flex min-h-16 w-full items-center justify-between rounded-xl bg-surface px-3 text-left">
                  <span>
                    <span className="tabular block font-semibold">{formatXof(item.amountXof)}</span>
                    <span className="text-sm text-muted">
                      {formatWhen(item.paidAt ?? item.createdAt).split(", ")[1]} · {invoiceBadge(item.status)} · {channelLabel(item.channel)}
                      {item.payerNickname ? ` · ${item.payerNickname}` : ""}
                    </span>
                  </span>
                  {item.source === "seed" ? (
                    <span className="rounded-full bg-warning-bg px-2 py-1 text-xs font-medium text-warning">Historique simulé</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SalesTable({ items, onOpen }: { items: SaleItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl bg-surface lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Ventes de la période</caption>
        <thead className="border-b border-black/10 text-muted">
          <tr>
            <th className="px-3 py-3 font-medium">Montant</th>
            <th className="px-3 py-3 font-medium">Heure</th>
            <th className="px-3 py-3 font-medium">Statut</th>
            <th className="px-3 py-3 font-medium">Canal</th>
            <th className="px-3 py-3 font-medium">Client</th>
            <th className="px-3 py-3 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-black/5 last:border-0">
              <td className="px-3 py-3">
                <button type="button" className="tabular font-semibold" onClick={() => onOpen(item.id)}>
                  {formatXof(item.amountXof)}
                </button>
              </td>
              <td className="px-3 py-3">{formatWhen(item.paidAt ?? item.createdAt)}</td>
              <td className="px-3 py-3">{invoiceBadge(item.status)}</td>
              <td className="px-3 py-3">{channelLabel(item.channel)}</td>
              <td className="px-3 py-3">{item.payerNickname ?? "—"}</td>
              <td className="px-3 py-3">{item.source === "seed" ? "Historique simulé" : "En direct"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SaleSheet({ item, onClose }: { item: SaleItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="Détail de la vente">
      <div className="w-full max-w-[480px] rounded-t-[20px] bg-surface p-4 pb-8 lg:rounded-2xl lg:pb-4">
        <h2 className="text-lg font-semibold">Vente</h2>
        <p className="tabular mt-2 text-[28px] font-bold">{formatXof(item.amountXof)}</p>
        {item.amountSats != null ? <p className="text-sm text-muted">{formatSats(item.amountSats)}</p> : null}
        <p className="mt-2 text-sm">{invoiceBadge(item.status)} · {channelLabel(item.channel)}</p>
        <p className="text-sm text-muted">Créée {formatWhen(item.createdAt)}</p>
        {item.paidAt ? <p className="text-sm text-muted">Payée {formatWhen(item.paidAt)}</p> : null}
        <p className="mt-2 text-sm">Référence {shortProof(item.id)}</p>
        {item.source === "seed" ? <p className="mt-2 text-sm text-warning">Historique simulé</p> : null}
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const api = useApi();
  const online = useOnline();
  const desktop = useDesktop();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("today");
  const bounds = rangeBounds(range);
  const query = useQuery({
    queryKey: ["dashboard", range],
    queryFn: async () => {
      const dashboard = await api.dashboard(range);
      stampCache();
      return dashboard;
    },
    refetchInterval: online ? 10_000 : false,
  });
  const sales = useQuery({
    queryKey: ["sales", bounds.from, bounds.to],
    queryFn: () => api.sales(bounds.from, bounds.to),
    enabled: desktop,
  });
  const score = useQuery({
    queryKey: ["score"],
    queryFn: () => api.score(),
    enabled: desktop,
  });
  const state = screenState({
    online,
    loading: query.isLoading,
    error: query.isError,
    empty: false,
    hasData: Boolean(query.data),
  });
  const data = query.data;

  return (
    <Page title="Tableau de bord">
      <ShopHeader />
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(["today", "7d", "30d"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={range === key}
            className={`min-h-12 rounded-full text-sm font-semibold ${range === key ? "bg-primary text-white" : "bg-surface"}`}
            onClick={() => setRange(key)}
          >
            {key === "today" ? "Aujourd'hui" : key === "7d" ? "7 j" : "30 j"}
          </button>
        ))}
      </div>
      {state === "loading" ? (
        <div className="grid gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {state === "offline" ? <ErrorState message="Hors ligne : aucune donnée en cache." /> : null}
      {state === "error" ? <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} /> : null}
      {state === "ready" && data ? (
        <div className="flex flex-col gap-4">
          {data.kpis.salesCount < 5 ? (
            <p className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">
              Encore peu de ventes pour lire une tendance.
            </p>
          ) : null}
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-3">
            <article className="rounded-xl bg-surface p-4 shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
              <p className="text-sm text-muted">Chiffre d'affaires</p>
              <p className="tabular text-[32px] leading-10 font-bold">{formatXof(data.kpis.revenueXof)}</p>
              <p className="text-sm">{formatDelta(data.kpis.revenueDeltaPct) ?? "Pas de comparaison"}</p>
            </article>
            <div className="grid grid-cols-2 gap-3 lg:contents">
              <Kpi label="Ventes" value={String(data.kpis.salesCount)} />
              <Kpi label="Panier moyen" value={data.kpis.averageBasketXof === null ? "—" : formatXof(data.kpis.averageBasketXof)} />
              <Kpi label="Taux de paiement" value={formatPercent(data.kpis.conversionRate)} />
              <Kpi label="Meilleur jour" value={data.kpis.bestDay ?? "—"} />
            </div>
          </div>
          {data.kpis.medianPaySeconds !== null ? (
            <p>Vos clients paient en {Math.round(data.kpis.medianPaySeconds)} s.</p>
          ) : null}
          {data.kpis.peakLabel ? <p>{data.kpis.peakLabel}</p> : null}
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
            {data.advice ? (
              <article className="rounded-xl bg-success-bg p-4 lg:col-start-2 lg:row-start-1">
                <h2 className="font-semibold">Conseil du jour</h2>
                <p className="mt-1">{data.advice.text}</p>
                {data.advice.figures ? <p className="mt-1 text-sm text-muted">{data.advice.figures}</p> : null}
              </article>
            ) : null}
            <section className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
              <h2 className="mb-2 font-semibold">Heures de pointe</h2>
              <Heatmap cells={data.heatmap} />
            </section>
            <section className="lg:col-start-2">
              <h2 className="mb-2 font-semibold">Clients fidèles</h2>
              {data.loyal.length === 0 ? (
                <p className="text-sm text-muted">Pas encore de client identifié.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.loyal.map((client) => (
                    <li key={client.nickname} className="rounded-xl bg-surface px-3 py-2 text-sm">
                      {client.nickname} · {client.purchases} achats · {formatXof(client.revenueXof)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="hidden gap-4 lg:grid lg:grid-cols-2">
            <section className="rounded-xl bg-surface p-4">
              <h2 className="mb-3 font-semibold">Ventes</h2>
              {sales.isLoading ? <Skeleton className="h-24" /> : null}
              {sales.data && sales.data.items.length === 0 ? (
                <p className="text-sm text-muted">Aucune vente sur cette période.</p>
              ) : null}
              {sales.data && sales.data.items.length > 0 ? (
                <SalesTable items={sales.data.items} onOpen={(id) => navigate(`/app/sales?vente=${id}`)} />
              ) : null}
            </section>
            <section className="rounded-xl bg-surface p-4">
              <h2 className="font-semibold">Score</h2>
              {score.isLoading ? <Skeleton className="mt-3 h-24" /> : null}
              {score.data ? (
                <div className="mt-3 grid gap-4">
                  <div>
                    <ScoreGauge score={score.data.score} band={score.data.band} />
                    <p className="text-center text-sm text-muted">Score indicatif, non recalculé ici.</p>
                    <Link to="/app/score" className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary">
                      Voir le détail
                    </Link>
                  </div>
                  <article className="rounded-xl bg-success-bg p-4">
                    <h3 className="font-semibold">Attestation</h3>
                    <p className="mt-1 text-sm">Le lien reprend le score renvoyé par le serveur.</p>
                    <Button
                      type="button"
                      className="mt-3"
                      disabled={!online || !score.data.eligible}
                      onClick={() => {
                        void api.shareScore().then(async (result) => {
                          await navigator.clipboard.writeText(result.url);
                          useToast.getState().show("Lien d'attestation copié");
                        });
                      }}
                    >
                      Partager mon attestation
                    </Button>
                  </article>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgba(17,24,39,0.08)]">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </article>
  );
}

export function ScorePage() {
  const api = useApi();
  const online = useOnline();
  const [open, setOpen] = useState<keyof typeof COMPONENT_COPY | null>(null);
  const query = useQuery({
    queryKey: ["score"],
    queryFn: async () => {
      const score = await api.score();
      stampCache();
      return score;
    },
  });
  const state = screenState({
    online,
    loading: query.isLoading,
    error: query.isError,
    empty: false,
    hasData: Boolean(query.data),
  });
  const data = query.data;
  const detail = useMemo(() => (open ? COMPONENT_COPY[open] : null), [open]);

  async function share() {
    const result = await api.shareScore();
    await navigator.clipboard.writeText(result.url);
    useToast.getState().show("Lien d'attestation copié");
  }

  return (
    <Page
      title="Score"
      actionClassName="lg:hidden"
      action={
        <Button type="button" onClick={() => void share()} disabled={!online || !data?.eligible}>
          Partager mon attestation
        </Button>
      }
    >
      <ShopHeader />
      <p className="mb-3 text-sm text-muted">Score indicatif, non utilisé pour un prêt.</p>
      {state === "loading" ? <Skeleton className="h-40" /> : null}
      {state === "offline" ? <ErrorState message="Hors ligne : aucun score en cache." /> : null}
      {state === "error" ? <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} /> : null}
      {state === "ready" && data ? (
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          <div>
          {!data.eligible ? (
            <p className="mb-3 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">
              Score en construction
              {data.progress
                ? ` · J+${data.progress.daysSinceFirst}/14 · ${data.progress.salesCount}/20 ventes`
                : ""}
            </p>
          ) : null}
          <ScoreGauge score={data.score} band={data.band} />
          {data.computedAt ? <p className="text-center text-sm text-muted">Calculé {formatWhen(data.computedAt)}</p> : null}
          <article className="mt-4 hidden rounded-xl bg-surface p-4 lg:block">
            <h2 className="font-semibold">Attestation</h2>
            <p className="mt-1 text-sm text-muted">Lien en lecture seule. Le score affiché est celui du serveur.</p>
            <div className="mt-3">
              <Button type="button" onClick={() => void share()} disabled={!online || !data.eligible}>
                Partager mon attestation
              </Button>
            </div>
          </article>
          </div>
          <div>
          <ul className="mt-4 flex flex-col gap-3 lg:mt-0">
            {data.components.map((component) => {
              const copy = COMPONENT_COPY[component.key];
              return (
                <li key={component.key}>
                  <button type="button" className="w-full text-left" onClick={() => setOpen(component.key)}>
                    <span className="flex justify-between text-sm">
                      <span>{copy.label}</span>
                      <span className="text-muted">{copy.weight}</span>
                    </span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-black/10">
                      <span className="block h-full bg-primary" style={{ width: `${Math.max(0, Math.min(1, component.value)) * 100}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {data.actions.length > 0 ? (
            <section className="mt-4">
              <h2 className="font-semibold">{data.actions.length} action{data.actions.length > 1 ? "s" : ""} pour progresser</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {data.actions.map((action) => (
                  <li key={action.text} className="rounded-xl bg-surface px-3 py-2 text-sm">
                    {action.text} · +{action.points} points
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          </div>
        </div>
      ) : null}
      {detail && open && data ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={detail.label}>
          <div className="w-full max-w-[480px] rounded-t-[20px] bg-surface p-4 pb-8">
            <h2 className="text-lg font-semibold">{detail.label}</h2>
            <p className="mt-2">{detail.help}</p>
            <p className="mt-2 text-sm text-muted">Poids affiché : {detail.weight}. La valeur vient du serveur.</p>
            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </Page>
  );
}
