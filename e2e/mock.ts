import type { Page, Route } from "@playwright/test";

const user = { id: "u1", phoneMasked: "77•••••67" };
const merchant = {
  id: "m1",
  slug: "awa-beaute",
  displayName: "Awa Beauté",
  category: "beaute",
  qrUrl: "http://127.0.0.1:4173/p/awa-beaute",
};
const session = { expiresAt: "2099-01-01T00:00:00.000Z" };

export type PublicInvoiceMock = {
  status: "pending" | "paid" | "expired" | "failed";
  payMethod: string | null;
  bolt11?: string;
};

export async function mockApi(page: Page): Promise<{ pub: PublicInvoiceMock }> {
  const pub: PublicInvoiceMock = { status: "pending", payMethod: null };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const send = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/health") return send(200, { ok: true, bitnob: true });
    if (path === "/api/auth/me") return send(200, { user, merchant, session });
    if (path === "/api/rates") {
      return send(200, {
        btcXof: 65_000_000,
        btcUsd: 100_000,
        usdXof: 650,
        ts: "2026-10-17T18:00:00.000Z",
        validFor: 60,
        source: "sandbox",
      });
    }
    if (path === "/api/invoices" && method === "POST") {
      return send(201, {
        invoice: {
          id: "inv-bureau",
          status: "pending",
          amountXof: 2500,
          amountSats: 4230,
          bolt11: "lntb1bureau",
          expiresAt: "2099-01-01T00:15:00.000Z",
          paidAt: null,
          label: null,
          channel: "dynamic",
          source: "live",
          payMethod: null,
        },
      });
    }
    if (path === "/api/invoices/inv-bureau") {
      return send(200, {
        invoice: {
          id: "inv-bureau",
          status: "pending",
          amountXof: 2500,
          amountSats: 4230,
          bolt11: "lntb1bureau",
          expiresAt: "2099-01-01T00:15:00.000Z",
          paidAt: null,
          label: "Beurre",
          channel: "dynamic",
          source: "live",
          payMethod: null,
        },
      });
    }
    if (path === "/api/invoices/inv-paid") {
      return send(200, {
        invoice: {
          id: "inv-paid",
          status: "paid",
          amountXof: 2500,
          amountSats: 4230,
          bolt11: "lntb1paid",
          expiresAt: "2099-01-01T00:15:00.000Z",
          paidAt: "2026-10-17T18:31:00.000Z",
          label: "Beurre",
          channel: "dynamic",
          source: "live",
          payMethod: "wave",
          paymentHash: "9f2c4d7a1be04c6f8d3a5e7b90c1d2e3f4a5b6c7d8e9f00112233445566778899",
        },
      });
    }
    if (path === "/api/public/invoices/inv-client/pay" && method === "POST") {
      const body = request.postDataJSON() as { method?: string };
      pub.payMethod = body.method ?? null;
      if (pub.payMethod === "lightning") pub.bolt11 = "lntb25u1pjaaykatdemo0qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
      return send(200, { status: pub.status, amountXof: 2500, expiresAt: new Date(Date.now() + 14 * 60_000).toISOString(), demoPayment: true, ...pub });
    }
    if (path === "/api/public/invoices/inv-client") {
      return send(200, {
        amountXof: 2500,
        expiresAt: new Date(Date.now() + 14 * 60_000).toISOString(),
        demoPayment: true,
        ...pub,
        ...(pub.status === "paid" ? { paidAt: "2026-10-17T18:31:00.000Z" } : {}),
      });
    }
    if (path === "/api/public/shops/awa-beaute") return send(200, { name: "Awa Beauté", category: "beaute" });
    if (path === "/api/dashboard") {
      return send(200, {
        kpis: {
          revenueXof: 12500,
          revenueDeltaPct: 0.2,
          salesCount: 8,
          averageBasketXof: 1562,
          conversionRate: 0.9,
          medianPaySeconds: 9,
          bestDay: "samedi",
          peakLabel: "Votre pic : 18h–20h",
        },
        heatmap: [{ weekday: 5, hour: 18, salesCount: 3, revenueXof: 7500 }],
        loyal: [{ nickname: "Fatou", purchases: 6, revenueXof: 42000 }],
        advice: { text: "Montrez le QR de plus près.", figures: "3 clients sur 10" },
      });
    }
    if (path === "/api/sales") {
      return send(200, {
        items: [
          {
            id: "sale-1",
            status: "paid",
            amountXof: 2500,
            amountSats: 4230,
            createdAt: "2026-10-17T18:30:00.000Z",
            paidAt: "2026-10-17T18:31:00.000Z",
            label: "Beurre",
            channel: "dynamic",
            source: "live",
            payerNickname: "Fatou",
          },
          {
            id: "sale-2",
            status: "paid",
            amountXof: 10000,
            createdAt: "2026-10-17T12:00:00.000Z",
            paidAt: "2026-10-17T12:02:00.000Z",
            label: null,
            channel: "static_qr",
            source: "seed",
            payerNickname: null,
          },
        ],
      });
    }
    if (path === "/api/score") {
      return send(200, {
        score: 71,
        band: "B",
        eligible: true,
        computedAt: "2026-10-17T18:00:00.000Z",
        progress: null,
        components: [
          { key: "regularity", value: 0.76 },
          { key: "growth", value: 0.6 },
          { key: "volume", value: 0.92 },
          { key: "loyalty", value: 0.45 },
          { key: "quality", value: 0.88 },
        ],
        actions: [{ text: "Encaissez au moins une vente par jour", points: 6 }],
      });
    }
    if (path === "/api/balance") return send(200, { balanceXof: 12500, balanceSats: 21000, lastPayouts: [] });
    return send(404, { error: "NOT_FOUND", message: `Route absente du mock : ${method} ${path}` });
  });
  return { pub };
}

export async function seedSession(page: Page) {
  await page.addInitScript(
    ({ storedUser, storedMerchant, expiresAt }) => {
      const publicPath = location.pathname.startsWith("/p/") || ["/app/login", "/app/register"].includes(location.pathname);
      if (publicPath) return;
      localStorage.setItem("jk.session", JSON.stringify({ token: "tok", expiresAt }));
      localStorage.setItem("jk.profile", JSON.stringify({ user: storedUser, merchant: storedMerchant }));
      localStorage.setItem("jk.installLater", "1");
    },
    { storedUser: user, storedMerchant: merchant, expiresAt: session.expiresAt },
  );
}

