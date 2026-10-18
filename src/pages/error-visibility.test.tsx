import { focusManager } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderAt } from "../test/render";

vi.mock("../lib/resilience", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/resilience")>();
  return {
    ...actual,
    POLL_INTERVAL_MS: 40,
    PERSISTENT_FAILURE_MS: 700,
    pollRetryDelay: () => 10,
    payRetryDelay: () => 10,
  };
});

const me = {
  user: { id: "u1", phoneMasked: "7767" },
  merchant: { id: "m1", slug: "awa-beaute", displayName: "Awa Beauté", category: "beaute", qrUrl: "https://demo.example/p/awa-beaute" },
  session: { expiresAt: "2099-01-01T00:00:00.000Z" },
};

function pathOf(input: RequestInfo | URL): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return url.startsWith("http") ? new URL(url).pathname : url.split("?")[0] ?? "";
}

function harness(handler: (path: string, method: string, count: number) => Response | undefined) {
  const counts = new Map<string, number>();
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${path}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    if (path === "/api/auth/me") return jsonResponse(200, me);
    return handler(path, method, count) ?? jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
  }) as typeof fetch;
  return { fetchImpl, count: (key: string) => counts.get(key) ?? 0 };
}

function watchText(pattern: RegExp) {
  const seen = { ever: false };
  const observer = new MutationObserver(() => {
    if (pattern.test(document.body.textContent ?? "")) seen.ever = true;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return { seen, stop: () => observer.disconnect() };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("les vraies erreurs restent visibles et ne sont pas rejouees", () => {
  it("redirige vers la connexion sur un 401 sans reessayer", async () => {
    const h = harness((path) =>
      path === "/api/invoices/inv-1" ? jsonResponse(401, { error: "UNAUTHENTICATED", message: "Session expirée" }) : undefined,
    );
    renderAt("/app/invoice/inv-1", h.fetchImpl, true);
    expect(await screen.findByRole("heading", { name: "Se connecter" }, { timeout: 3000 })).toBeInTheDocument();
    expect(h.count("GET /api/invoices/inv-1")).toBe(1);
    expect(localStorage.getItem("jk.session")).toBeNull();
  });

  it.each([
    [404, "NOT_FOUND", "Facture introuvable."],
    [422, "VALIDATION", "Donnée refusée."],
    [409, "CONFLICT", "Conflit détecté."],
    [400, "VALIDATION", "Requête invalide."],
  ])("affiche tout de suite un %i lisible, sans reprise", async (status, code, message) => {
    const h = harness((path) => (path === "/api/invoices/inv-x" ? jsonResponse(status, { error: code, message }) : undefined));
    renderAt("/app/invoice/inv-x", h.fetchImpl, true);
    expect(await screen.findByText(message)).toBeInTheDocument();
    await wait(200);
    expect(h.count("GET /api/invoices/inv-x")).toBe(1);
  });

  it("limite les reprises d'un 503 persistant puis affiche l'erreur", async () => {
    const h = harness((path) =>
      path === "/api/invoices/inv-down" ? jsonResponse(503, { error: "UNAVAILABLE", message: "Service indisponible." }) : undefined,
    );
    renderAt("/app/invoice/inv-down", h.fetchImpl, true);
    expect(await screen.findByText("Service indisponible.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(h.count("GET /api/invoices/inv-down")).toBe(4);
  });

  it("n'envoie qu'une seule creation de facture sur un 503", async () => {
    const h = harness((path, method) => {
      if (path === "/api/rates") {
        return jsonResponse(200, { btcXof: 60000000, btcUsd: 100000, usdXof: 600, ts: "2026-10-17T18:00:00.000Z", validFor: 60, source: "sandbox" });
      }
      if (path === "/api/invoices" && method === "POST") {
        return jsonResponse(503, { error: "BITNOB_UNAVAILABLE", message: "La création a échoué, rien n'a été enregistré." });
      }
      return undefined;
    });
    renderAt("/app/charge", h.fetchImpl, true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Générer le QR" }));
    expect(await screen.findByText("La création a échoué, rien n'a été enregistré.")).toBeInTheDocument();
    await wait(300);
    expect(h.count("POST /api/invoices")).toBe(1);
  });

  it("garde le suivi de retrait affiche quand un rafraichissement echoue", async () => {
    const payout = (status: string) => ({
      payout: { id: "po-1", status, amountXof: 5000, network: "wave", reference: "jk_ref_1", failureReason: null },
    });
    const watch = watchText(/Suivi indisponible|Une erreur|Réessay/);
    const h = harness((path, _method, count) => {
      if (path !== "/api/payouts/po-1") return undefined;
      if (count >= 2 && count <= 5) return jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." });
      return jsonResponse(200, payout(count > 5 ? "completed" : "processing"));
    });
    renderAt("/app/payout/po-1", h.fetchImpl, true);
    expect(await screen.findByText("En cours", { selector: "p.text-lg" })).toBeInTheDocument();
    expect(await screen.findByText("Envoyé", { selector: "p.text-lg" }, { timeout: 4000 })).toBeInTheDocument();
    expect(watch.seen.ever).toBe(false);
    watch.stop();
  });

  it("garde le solde affiche quand un rafraichissement echoue", async () => {
    const watch = watchText(/Solde indisponible|Une erreur|Réessay/);
    const h = harness((path, _method, count) => {
      if (path !== "/api/balance") return undefined;
      if (count >= 2) return jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." });
      return jsonResponse(200, { balanceXof: 5000, balanceSats: 8000, lastPayouts: [] });
    });
    renderAt("/app/balance", h.fetchImpl, true);
    await waitFor(() => expect(document.body.textContent).toMatch(/5\s?000/));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(h.count("GET /api/balance")).toBeGreaterThanOrEqual(2));
    await wait(200);
    expect(document.body.textContent).toMatch(/5\s?000/);
    expect(watch.seen.ever).toBe(false);
    watch.stop();
  });
});
