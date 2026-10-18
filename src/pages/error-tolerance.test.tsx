import { screen } from "@testing-library/react";
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

function invoice(status: "pending" | "paid") {
  return {
    invoice: {
      id: "inv-wait",
      status,
      amountXof: 2500,
      amountSats: 4230,
      bolt11: "lntb1exampleinvoice",
      expiresAt: "2099-01-01T00:15:00.000Z",
      paidAt: status === "paid" ? "2026-10-17T18:42:00.000Z" : null,
      label: "Beurre",
      channel: "dynamic",
      source: "live",
      paymentHash: status === "paid" ? "a1b2c3d4e5f6" : null,
    },
  };
}

function watchText(pattern: RegExp) {
  const seen = { ever: false };
  const observer = new MutationObserver(() => {
    if (pattern.test(document.body.textContent ?? "")) seen.ever = true;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return { seen, stop: () => observer.disconnect() };
}

function pathOf(input: RequestInfo | URL): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return url.startsWith("http") ? new URL(url).pathname : url.split("?")[0] ?? "";
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("erreurs transitoires côté marchand et boutique", () => {
  it("garde la facture affichée quand le polling marchand reçoit des 429 et des 500", async () => {
    let calls = 0;
    const retry = watchText(/Réessay|Impossible de charger/);
    renderAt(
      "/app/invoice/inv-wait",
      (async (input: RequestInfo | URL) => {
        const path = pathOf(input);
        if (path === "/api/health") return jsonResponse(200, { ok: true });
        if (path === "/api/auth/me") return jsonResponse(200, me);
        if (path === "/api/invoices/inv-wait") {
          calls += 1;
          if (calls >= 3 && calls <= 8) {
            return calls % 2 === 0
              ? jsonResponse(429, { error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez dans un instant." })
              : jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." });
          }
          return jsonResponse(200, invoice(calls > 8 ? "paid" : "pending"));
        }
        return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
      }) as typeof fetch,
      true,
    );
    expect(await screen.findByText(/En attente/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Payé" }, { timeout: 4000 })).toBeInTheDocument();
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("n'avertit qu'après un échec persistant, sans masquer la facture", async () => {
    let failing = false;
    renderAt(
      "/app/invoice/inv-wait",
      (async (input: RequestInfo | URL) => {
        const path = pathOf(input);
        if (path === "/api/health") return jsonResponse(200, { ok: true });
        if (path === "/api/auth/me") return jsonResponse(200, me);
        if (path === "/api/invoices/inv-wait") {
          if (failing) return jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." });
          failing = true;
          return jsonResponse(200, invoice("pending"));
        }
        return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
      }) as typeof fetch,
      true,
    );
    expect(await screen.findByText(/En attente/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Réessayer" }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/En attente/)).toBeInTheDocument();
  });

  it("ne bloque pas l'encaissement quand le taux échoue une ou deux fois", async () => {
    let rateCalls = 0;
    const retry = watchText(/Taux indisponible|Réessay/);
    renderAt(
      "/app/charge",
      (async (input: RequestInfo | URL) => {
        const path = pathOf(input);
        if (path === "/api/health") return jsonResponse(200, { ok: true });
        if (path === "/api/auth/me") return jsonResponse(200, me);
        if (path === "/api/rates") {
          rateCalls += 1;
          if (rateCalls <= 2) return jsonResponse(503, { error: "BITNOB_UNAVAILABLE", message: "Taux indisponible." });
          return jsonResponse(200, { btcXof: 60000000, btcUsd: 100000, usdXof: 600, ts: "2026-10-17T18:00:00.000Z", validFor: 60, source: "sandbox" });
        }
        return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
      }) as typeof fetch,
      true,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(await screen.findByRole("button", { name: /^Encaisser/ })).toBeEnabled();
    expect(rateCalls).toBeGreaterThanOrEqual(3);
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("ne montre pas d'écran d'erreur à la page boutique pour un 503 passager", async () => {
    let shopCalls = 0;
    const retry = watchText(/Impossible de charger|Réessay/);
    renderAt("/p/awa-beaute", (async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path === "/api/health") return jsonResponse(200, { ok: true });
      if (path === "/api/public/shops/awa-beaute") {
        shopCalls += 1;
        if (shopCalls <= 2) return jsonResponse(503, { error: "UNAVAILABLE", message: "Service indisponible." });
        return jsonResponse(200, { name: "Awa Beauté", category: "beaute" });
      }
      return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    }) as typeof fetch);
    expect(await screen.findByRole("heading", { name: "Awa Beauté" })).toBeInTheDocument();
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("garde l'écran d'erreur immédiat pour une boutique inconnue", async () => {
    renderAt("/p/inconnue", (async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path === "/api/health") return jsonResponse(200, { ok: true });
      return jsonResponse(404, { error: "NOT_FOUND", message: "Boutique introuvable." });
    }) as typeof fetch);
    expect(await screen.findByRole("heading", { name: "Boutique introuvable" })).toBeInTheDocument();
  });
});
