import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderAt } from "../test/render";

const merchant = { id: "m1", slug: "awa-beaute", displayName: "Awa Beauté", category: "beaute", qrUrl: "https://demo.example/p/awa-beaute" };
const me = { user: { id: "u1", phoneMasked: "77•••••67" }, merchant, session: { expiresAt: "2099-01-01T00:00:00.000Z" } };

const components = [
  { key: "regularity", value: 0.76 },
  { key: "growth", value: 0.6 },
  { key: "volume", value: 0.92 },
  { key: "loyalty", value: 0.45 },
  { key: "quality", value: 0.88 },
];

function score(extra: Record<string, unknown> = {}) {
  return {
    score: 71,
    band: "B",
    eligible: true,
    demo: false,
    windowDays: 90,
    thresholds: { days: 14, sales: 20 },
    remaining: { days: 0, sales: 0 },
    computedAt: "2026-10-17T18:00:00.000Z",
    progress: { daysSinceFirst: 20, salesCount: 25 },
    components,
    actions: [],
    ...extra,
  };
}

const waiting = score({
  score: null,
  band: null,
  eligible: false,
  remaining: { days: 14, sales: 19 },
  progress: { daysSinceFirst: 0, salesCount: 1 },
  actions: [],
});

function harness(scoreBody: unknown, share?: () => Response) {
  let shareCalls = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = (url.startsWith("http") ? new URL(url).pathname : url).split("?")[0] ?? "";
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    if (path === "/api/auth/me") return jsonResponse(200, me);
    if (path === "/api/score" && (init?.method ?? "GET") === "GET") return jsonResponse(200, scoreBody);
    if (path === "/api/score/share" && init?.method === "POST") {
      shareCalls += 1;
      return share ? share() : jsonResponse(200, { url: "https://demo.example/s/abc" });
    }
    return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
  }) as typeof fetch;
  return { fetchImpl, shareCalls: () => shareCalls };
}

describe("écran Score : attestation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("désactive le bouton et explique ce qu'il reste à faire quand le marchand est inéligible", async () => {
    const h = harness(waiting);
    renderAt("/app/score", h.fetchImpl, true);
    const why = await screen.findAllByText("Attestation indisponible. Encore 19 ventes payées et 14 jours pour être éligible.");
    expect(why.length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", { name: "Partager mon attestation" })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(/Encore 19 ventes payées et 14 jours/);
    }
    expect(h.shareCalls()).toBe(0);
  });

  it("n'annonce que les jours restants quand les ventes suffisent", async () => {
    renderAt("/app/score", harness(score({ eligible: false, score: null, band: null, remaining: { days: 3, sales: 0 } })).fetchImpl, true);
    expect((await screen.findAllByText("Attestation indisponible. Encore 3 jours pour être éligible.")).length).toBeGreaterThan(0);
  });

  it("émet l'attestation, affiche le lien de vérification, son QR et sa durée", async () => {
    const h = harness(score());
    renderAt("/app/score", h.fetchImpl, true);
    const user = userEvent.setup();
    const [button] = await screen.findAllByRole("button", { name: "Partager mon attestation" });
    await user.click(button!);
    const panel = await screen.findByRole("region", { name: "Attestation émise" });
    expect(within(panel).getByText("https://demo.example/s/abc")).toBeInTheDocument();
    expect(await within(panel).findByRole("img", { name: /QR/ })).toBeInTheDocument();
    expect(panel).toHaveTextContent("7 jours");
    expect(within(panel).getByRole("link", { name: "Ouvrir l'attestation" })).toHaveAttribute("href", "/s/abc");
    expect(h.shareCalls()).toBe(1);
  });

  it("montre le refus du serveur au lieu de l'ignorer", async () => {
    const h = harness(score(), () =>
      jsonResponse(422, { error: "NOT_ELIGIBLE", message: "Attestation indisponible. Encore 1 vente payée pour être éligible." }),
    );
    renderAt("/app/score", h.fetchImpl, true);
    const user = userEvent.setup();
    const [button] = await screen.findAllByRole("button", { name: "Partager mon attestation" });
    await user.click(button!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Attestation indisponible. Encore 1 vente payée pour être éligible.");
    expect(screen.queryByRole("region", { name: "Attestation émise" })).toBeNull();
  });

  it("signale les données de démonstration et affiche les règles de calcul", async () => {
    renderAt("/app/score", harness(score({ demo: true })).fetchImpl, true);
    expect(await screen.findByText(/Données de démonstration/)).toBeInTheDocument();
    const rules = await screen.findByRole("region", { name: "Règles du score" });
    expect(rules).toHaveTextContent("90 derniers jours");
    expect(rules).toHaveTextContent("20 ventes payées");
    expect(rules).toHaveTextContent("14 jours");
    expect(rules).toHaveTextContent("ventes payées uniquement");
  });
});

function attestation(extra: Record<string, unknown> = {}) {
  return {
    attestationId: "JK-7KQ2-M9XA",
    shopName: "Chez Awa",
    status: "valid",
    issuedAt: "2026-10-17T18:00:00.000Z",
    expiresAt: "2026-10-24T18:00:00.000Z",
    demo: false,
    environment: "live",
    windowDays: 90,
    score: 71,
    band: "B",
    period: { from: "2026-09-27", to: "2026-10-17" },
    salesCount: 25,
    totalXof: 62_500,
    ...extra,
  };
}

function publicHarness(body: unknown, status = 200) {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = (url.startsWith("http") ? new URL(url).pathname : url).split("?")[0] ?? "";
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    if (path === "/api/public/shares/tok") return jsonResponse(status, body);
    return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
  }) as typeof fetch;
}

describe("attestation publique", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("affiche le périmètre, le score, l'identifiant et ce qu'elle atteste ou non", async () => {
    renderAt("/s/tok", publicHarness(attestation()));
    expect(await screen.findByRole("heading", { name: "Chez Awa" })).toBeInTheDocument();
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("JK-7KQ2-M9XA");
    expect(card).toHaveTextContent("27 sept. 2026");
    expect(card).toHaveTextContent("17 oct. 2026");
    expect(card).toHaveTextContent("25");
    expect(card).toHaveTextContent(/62\s500\sF/);
    expect(card).toHaveTextContent("71 / 100");
    expect(card).toHaveTextContent("Bande B");
    expect(card).toHaveTextContent("Émise le");
    expect(screen.getByText("Attestation valide jusqu'au", { exact: false })).toBeInTheDocument();
    const atteste = screen.getByRole("region", { name: "Ce que cette attestation atteste" });
    expect(atteste).toHaveTextContent("25 paiements Lightning");
    const limits = screen.getByRole("region", { name: "Ce qu'elle n'atteste pas" });
    expect(limits).toHaveTextContent("garantie de crédit");
    expect(limits).toHaveTextContent("identité");
    expect(await screen.findByRole("img", { name: /QR/ })).toBeInTheDocument();
    expect(screen.queryByText(/Démonstration/)).toBeNull();
    expect(screen.queryByText(/réseau de test/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\+221|77\d{7}|PIN/);
  });

  it("étiquette la démonstration et le réseau de test", async () => {
    renderAt("/s/tok", publicHarness(attestation({ demo: true, environment: "sandbox" })));
    expect(await screen.findByText(/Démonstration/)).toBeInTheDocument();
    expect(screen.getByText(/historique de ventes simulé/)).toBeInTheDocument();
    expect(screen.getByText(/Réseau de test Bitnob \(sandbox\)/)).toBeInTheDocument();
    const atteste = screen.getByRole("region", { name: "Ce que cette attestation atteste" });
    expect(atteste).toHaveTextContent("Rien de réel");
    expect(atteste).not.toHaveTextContent("paiements Lightning ont été enregistrés");
  });

  it("ne présente pas comme réels des paiements dont l'environnement n'a pas pu être vérifié", async () => {
    renderAt("/s/tok", publicHarness(attestation({ environment: "unknown" })));
    expect(await screen.findByText(/Environnement Bitnob non vérifié à l'émission/)).toBeInTheDocument();
  });

  it("signale une attestation expirée", async () => {
    renderAt("/s/tok", publicHarness(attestation({ status: "expired" })));
    expect(await screen.findByText("Attestation expirée le", { exact: false })).toBeInTheDocument();
  });

  it("ne montre ni score ni chiffres pour une attestation révoquée", async () => {
    renderAt(
      "/s/tok",
      publicHarness(attestation({ status: "revoked", score: null, band: null, period: null, salesCount: null, totalXof: null })),
    );
    expect(await screen.findByText("Cette attestation a été révoquée. Elle n'est plus valable.")).toBeInTheDocument();
    expect(screen.queryByText(/\/ 100/)).toBeNull();
    expect(screen.queryByText(/62\s500/)).toBeNull();
  });

  it("indique un lien inconnu", async () => {
    renderAt("/s/tok", publicHarness({ error: "NOT_FOUND", message: "Attestation introuvable." }, 404));
    expect(await screen.findByText("Attestation introuvable, expirée ou révoquée.")).toBeInTheDocument();
  });
});
