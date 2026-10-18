import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const expiresAt = "2099-01-01T00:15:00.000Z";

type Harness = {
  payCalls: number;
  pollCalls: number;
  paidAfterPolls: number;
  pollAllowed: boolean;
  paySentAt: number | null;
  payHandler: (call: number) => Response | Promise<Response>;
  pollFault: (state: Harness) => Response | Promise<Response> | null;
};

function acceptedPay(): Response {
  return jsonResponse(202, { status: "pending", amountXof: 2500, expiresAt, demoPayment: true, payMethod: "wave" });
}

function harness(overrides: Partial<Harness> = {}) {
  const state: Harness = {
    payCalls: 0,
    pollCalls: 0,
    paidAfterPolls: 3,
    pollAllowed: true,
    paySentAt: null,
    payHandler: () => acceptedPay(),
    pollFault: () => null,
    ...overrides,
  };
  let pollsAfterPay = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    if (path === "/api/public/shops/awa-beaute") return jsonResponse(200, { name: "Awa Beauté", category: "beaute" });
    if (path === "/api/public/invoices/inv-1/pay") {
      state.payCalls += 1;
      const response = await state.payHandler(state.payCalls);
      if (response.status === 202 && state.paySentAt === null) state.paySentAt = Date.now();
      return response;
    }
    if (path === "/api/public/invoices/inv-1") {
      state.pollCalls += 1;
      if (state.paySentAt !== null) {
        const fault = state.pollFault(state);
        if (fault) return fault;
        pollsAfterPay += 1;
      }
      const sent = state.paySentAt !== null;
      const paid = sent && state.pollAllowed && pollsAfterPay >= state.paidAfterPolls;
      return jsonResponse(200, {
        status: paid ? "paid" : "pending",
        amountXof: 2500,
        expiresAt,
        demoPayment: true,
        payMethod: sent ? "wave" : null,
      });
    }
    return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
  }) as typeof fetch;
  return { state, fetchImpl };
}

function watchText(pattern: RegExp) {
  const seen = { ever: false };
  const check = () => {
    if (pattern.test(document.body.textContent ?? "")) seen.ever = true;
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return { seen, stop: () => observer.disconnect() };
}

async function reachConfirm(fetchImpl: typeof fetch) {
  const user = userEvent.setup();
  renderAt("/p/awa-beaute?facture=inv-1", fetchImpl);
  await user.click(await screen.findByRole("button", { name: /^Wave/ }));
  const confirm = await screen.findByRole("button", { name: /Confirmer le paiement de/ });
  return { user, confirm };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("paiement client résilient", () => {
  it("passe tout de suite à Paiement en cours quand /pay est lent et ne le poste qu'une fois", async () => {
    const { state, fetchImpl } = harness({
      payHandler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return acceptedPay();
      },
    });
    const retry = watchText(/Réessay/);
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement en cours" }, { timeout: 200 })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Confirmation");
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Paiement en cours" })).not.toBeInTheDocument();
    expect(state.payCalls).toBe(1);
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("ignore un double clic sur Confirmer", async () => {
    const { state, fetchImpl } = harness();
    const { confirm } = await reachConfirm(fetchImpl);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(state.payCalls).toBe(1);
  });

  it("réessaie /pay en silence sur 429 puis 503 sans afficher d'erreur", async () => {
    const { state, fetchImpl } = harness({
      payHandler: (call) => {
        if (call === 1) return jsonResponse(429, { error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez dans un instant." });
        if (call === 2) return jsonResponse(503, { error: "UNAVAILABLE", message: "Service indisponible." });
        return acceptedPay();
      },
    });
    const retry = watchText(/Réessay|indisponible|Trop de tentatives/);
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(state.payCalls).toBe(3);
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("tolère une rafale de 429 sur le polling sans changer d'écran", async () => {
    const start = { at: 0 };
    const { fetchImpl } = harness({
      pollFault: () => {
        start.at = start.at || Date.now();
        if (Date.now() - start.at < 300) {
          return jsonResponse(429, { error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez dans un instant.", retryAfterSeconds: 30 });
        }
        return null;
      },
    });
    const retry = watchText(/Réessay|Trop de tentatives/);
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement en cours" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("tolère une erreur réseau puis un 500 transitoires sur le polling", async () => {
    let faults = 0;
    const { fetchImpl: base } = harness({
      pollFault: () => {
        faults += 1;
        if (faults === 1) throw new TypeError("Failed to fetch");
        if (faults <= 4) return jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." });
        return null;
      },
    });
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => base(input, init)) as typeof fetch;
    const retry = watchText(/Réessay|Une erreur est survenue/);
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(faults).toBeGreaterThanOrEqual(5);
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("n'affiche une erreur qu'après un échec persistant du polling, puis la retire au retour du réseau", async () => {
    const { state, fetchImpl } = harness({
      pollFault: () => jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." }),
    });
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement en cours" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Réessayer" }, { timeout: 3000 })).toBeInTheDocument();
    state.pollFault = () => null;
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
  });

  it("propose Réessayer seulement quand /pay échoue durablement, puis relance l'envoi", async () => {
    const { state, fetchImpl } = harness({
      payHandler: () => jsonResponse(500, { error: "INTERNAL", message: "Une erreur est survenue." }),
    });
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Paiement en cours" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
    const button = await screen.findByRole("button", { name: "Réessayer" }, { timeout: 3000 });
    const before = state.payCalls;
    state.payHandler = () => acceptedPay();
    await user.click(button);
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 4000 })).toBeInTheDocument();
    expect(state.payCalls).toBe(before + 1);
  });

  it("laisse le polling annoncer une facture expirée quand /pay répond 409", async () => {
    let expired = false;
    const { fetchImpl: base } = harness({
      payHandler: () => {
        expired = true;
        return jsonResponse(409, { error: "EXPIRED", message: "Cette facture a expiré." });
      },
    });
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (expired && url.endsWith("/api/public/invoices/inv-1")) {
        return jsonResponse(200, { status: "expired", amountXof: 2500, expiresAt, demoPayment: true, payMethod: null });
      }
      return base(input, init);
    }) as typeof fetch;
    const retry = watchText(/Réessay/);
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    expect(await screen.findByRole("heading", { name: "Facture expirée" }, { timeout: 3000 })).toBeInTheDocument();
    expect(retry.seen.ever).toBe(false);
    retry.stop();
  });

  it("revient à la confirmation avec le message si /pay refuse la demande (400)", async () => {
    const { fetchImpl } = harness({
      payHandler: () => jsonResponse(400, { error: "VALIDATION", message: "Moyen de paiement invalide." }),
    });
    const { user, confirm } = await reachConfirm(fetchImpl);
    await user.click(confirm);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Moyen de paiement invalide."));
    expect(screen.getByRole("heading", { name: "Confirmer le paiement" })).toBeInTheDocument();
  });

  it("affiche les logos des moyens de paiement sur le choix", async () => {
    const { fetchImpl } = harness();
    renderAt("/p/awa-beaute?facture=inv-1", fetchImpl);
    const wave = await screen.findByRole("button", { name: /^Wave/ });
    expect(wave.querySelector("img")).toHaveAttribute("alt", "Logo Wave");
    expect(wave.querySelector("img")).toHaveAttribute("width", "44");
    expect(wave.querySelector("img")).toHaveAttribute("height", "44");
    const orange = screen.getByRole("button", { name: /^Orange Money/ });
    expect(orange.querySelector("img")).toHaveAttribute("alt", "Logo Orange Money");
    for (const name of [/^Free Money/, /^Expresso/, /^Portefeuille Lightning/]) {
      expect(screen.getByRole("button", { name }).querySelector("[data-pay-logo]")).not.toBeNull();
    }
  });
});
