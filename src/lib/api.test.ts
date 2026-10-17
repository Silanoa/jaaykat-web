import { describe, expect, it, vi } from "vitest";
import { createApi } from "./api";
import { createMemoryStorage, writeStoredSession } from "./session";

const merchant = {
  id: "m1",
  slug: "awa-beaute",
  displayName: "Awa Beauté",
  category: "beaute",
  qrUrl: "https://demo.example/p/awa-beaute",
};

const invoice = {
  id: "inv1",
  status: "pending",
  amountXof: 2500,
  amountSats: 4230,
  bolt11: "lntb1example",
  expiresAt: "2026-10-17T18:15:00.000Z",
  paidAt: null,
  label: null,
  channel: "dynamic",
  source: "live",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("client HTTP", () => {
  it("envoie Bearer depuis jk.session", async () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
    let auth = "";
    const api = createApi({
      storage,
      fetch: async (_url, init) => {
        auth = new Headers(init?.headers).get("Authorization") ?? "";
        return json(200, {
          user: { id: "u1", phoneMasked: "77•••••67" },
          merchant,
          session: { expiresAt: "2099-01-01T00:00:00.000Z" },
        });
      },
    });
    const me = await api.me();
    expect(auth).toBe("Bearer tok");
    expect(me.merchant.slug).toBe("awa-beaute");
  });

  it("efface la session sur un 401 authentifié", async () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
    const onUnauthenticated = vi.fn();
    const api = createApi({
      storage,
      onUnauthenticated,
      fetch: async () => json(401, { error: "UNAUTHENTICATED", message: "Session expirée" }),
    });
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(storage.getItem("jk.session")).toBeNull();
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it("laisse le 401 du login sur l'écran de connexion", async () => {
    const onUnauthenticated = vi.fn();
    const api = createApi({
      storage: createMemoryStorage(),
      onUnauthenticated,
      fetch: async () =>
        json(401, { error: "INVALID_CREDENTIALS", attemptsLeft: 3, message: "Code incorrect" }),
    });
    await expect(api.login({ phone: "771234567", pin: "482915" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      attemptsLeft: 3,
    });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("envoie Idempotency-Key sur la création de facture", async () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
    let key = "";
    let url = "";
    let method = "";
    const api = createApi({
      storage,
      fetch: async (input, init) => {
        url = String(input);
        method = init?.method ?? "GET";
        key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
        return json(201, { invoice });
      },
    });
    const created = await api.createInvoice(
      { amountXof: 2500 },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(url).toBe("/api/invoices");
    expect(method).toBe("POST");
    expect(key).toBe("11111111-1111-4111-8111-111111111111");
    expect(created.status).toBe("pending");
    expect(created.amountSats).toBe(4230);
  });

  it("envoie Idempotency-Key seulement sur POST /api/payouts", async () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
    const seen: { url: string; key: string | null; method: string }[] = [];
    const api = createApi({
      storage,
      fetch: async (input, init) => {
        const url = String(input);
        seen.push({
          url,
          method: init?.method ?? "GET",
          key: new Headers(init?.headers).get("Idempotency-Key"),
        });
        if (url.endsWith("/quote")) {
          return json(200, {
            quote: {
              id: "q1",
              amountXof: 5000,
              receivedXof: 4800,
              exchangeRate: "1",
              fees: "200",
              network: "wave",
              accountNumberMasked: "77•••••67",
              accountName: "Awa Diop",
              expiresAt: "2026-10-17T18:16:00.000Z",
            },
          });
        }
        return json(201, {
          payout: {
            id: "p1",
            status: "processing",
            amountXof: 5000,
            network: "wave",
            reference: "jk_p1",
          },
        });
      },
    });
    await api.quotePayout({
      amountXof: 5000,
      network: "wave",
      accountNumber: "+221771234567",
      accountName: "Awa Diop",
    });
    await api.createPayout("q1", "22222222-2222-4222-8222-222222222222");
    expect(seen[0]).toMatchObject({ url: "/api/payouts/quote", method: "POST", key: null });
    expect(seen[1]).toMatchObject({
      url: "/api/payouts",
      method: "POST",
      key: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("ne marque jamais payé un corps illisible", async () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
    const api = createApi({
      storage,
      fetch: async () => json(200, { invoice: { id: "x", status: "almost" } }),
    });
    await expect(api.getInvoice("x")).rejects.toMatchObject({ code: "UNEXPECTED" });
  });
});
