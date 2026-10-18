import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderAt } from "../test/render";

const merchant = { id: "m1", slug: "awa-beaute", displayName: "Awa Beauté", category: "beaute", qrUrl: "https://demo.example/p/awa-beaute" };
const me = { user: { id: "u1", phoneMasked: "77•••••67" }, merchant, session: { expiresAt: "2099-01-01T00:00:00.000Z" } };

function balance(extra: Partial<{ balanceXof: number; demoRevenueXof: number; demoSalesCount: number }> = {}) {
  return { balanceXof: 8000, balanceSats: 13000, demoRevenueXof: 0, demoSalesCount: 0, lastPayouts: [], ...extra };
}

function harness(balanceBody: unknown) {
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = (url.startsWith("http") ? new URL(url).pathname : url).split("?")[0] ?? "";
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    if (path === "/api/auth/me") return jsonResponse(200, me);
    if (path === "/api/balance") return jsonResponse(200, balanceBody);
    if (path === "/api/payouts/quote") {
      posts.push({ path, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
      return jsonResponse(422, {
        error: "INSUFFICIENT_BALANCE",
        message: "Solde retirable insuffisant : 8\u00a0000\u00a0F disponibles. Le chiffre d'affaires de démonstration n'est pas retirable.",
      });
    }
    return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
  }) as typeof fetch;
  return { fetchImpl, posts };
}

describe("écran Retrait : choix du réseau", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("affiche une vignette de 44 px avec texte alternatif pour chaque réseau", async () => {
    renderAt("/app/payout", harness(balance()).fetchImpl, true);
    const group = await screen.findByRole("group", { name: "Réseau" });
    const expected = [
      ["Wave", "Logo Wave", "wave"],
      ["Orange Money", "Logo Orange Money", "orange"],
      ["Yas", "Logo Yas", "yas"],
      ["Expresso", "Logo Expresso", "expresso"],
    ] as const;
    for (const [name, alt, method] of expected) {
      const radio = within(group).getByRole("radio", { name });
      const tile = radio.closest("label") as HTMLElement;
      const image = within(tile).getByAltText(alt);
      expect(image).toHaveAttribute("width", "44");
      expect(image).toHaveAttribute("height", "44");
      expect(tile.querySelector(`[data-pay-logo="${method}"]`)).not.toBeNull();
    }
    expect(within(group).queryByText(/Free/)).toBeNull();
  });

  it("marque clairement le réseau choisi et envoie la valeur de fil free pour Yas", async () => {
    const h = harness(balance());
    renderAt("/app/payout", h.fetchImpl, true);
    const user = userEvent.setup();
    const group = await screen.findByRole("group", { name: "Réseau" });
    const wave = within(group).getByRole("radio", { name: "Wave" });
    const yas = within(group).getByRole("radio", { name: "Yas" });
    expect(wave).toBeChecked();
    expect(wave.closest("label")).toHaveAttribute("data-selected", "true");
    expect(yas.closest("label")).toHaveAttribute("data-selected", "false");

    await user.click(yas.closest("label") as HTMLElement);
    expect(yas).toBeChecked();
    expect(yas.closest("label")).toHaveAttribute("data-selected", "true");
    expect(wave.closest("label")).toHaveAttribute("data-selected", "false");

    for (const key of ["5", "0", "0", "0"]) await user.click(screen.getAllByRole("button", { name: key })[0]!);
    await user.type(screen.getByLabelText("Numéro"), "771234567");
    await user.type(screen.getByLabelText("Nom du titulaire"), "Awa Diop");
    await user.click(screen.getByRole("button", { name: "Voir le montant reçu" }));
    await vi.waitFor(() => expect(h.posts).toHaveLength(1));
    expect(h.posts[0]?.body).toMatchObject({ network: "free", amountXof: 5000 });
  });

  it("annonce le solde retirable et refuse au-delà avec le montant disponible", async () => {
    renderAt("/app/payout", harness(balance()).fetchImpl, true);
    const user = userEvent.setup();
    await vi.waitFor(() => expect(screen.getByText(/Solde retirable :/)).toHaveTextContent(/8\s000\sF/));
    for (const key of ["9", "0", "0", "0"]) await user.click(screen.getAllByRole("button", { name: key })[0]!);
    expect(await screen.findByText(/Solde retirable insuffisant : 8\s000\sF/)).toBeInTheDocument();
  });
});

describe("écran Solde : retirable ou démonstration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("sépare le solde retirable du chiffre d'affaires de démonstration", async () => {
    renderAt("/app/balance", harness(balance({ balanceXof: 0, demoRevenueXof: 187_500, demoSalesCount: 74 })).fetchImpl, true);
    expect(await screen.findByText("Solde retirable")).toBeInTheDocument();
    const demo = (await screen.findByText("Chiffre d'affaires de démonstration")).closest("section") as HTMLElement;
    expect(demo).toHaveTextContent(/187\s500\sF/);
    expect(demo).toHaveTextContent("74 ventes simulées");
    expect(demo).toHaveTextContent("non retirables");
    expect(screen.getByText("Pas encore de ventes retirables.")).toBeInTheDocument();
  });

  it("n'affiche aucun chiffre d'affaires de démonstration sans historique simulé", async () => {
    renderAt("/app/balance", harness(balance()).fetchImpl, true);
    expect(await screen.findByText("Solde retirable")).toBeInTheDocument();
    expect(screen.queryByText("Chiffre d'affaires de démonstration")).toBeNull();
  });
});
