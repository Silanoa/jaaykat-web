import { expect, test, type Page, type Route } from "@playwright/test";

const user = { id: "u1", phoneMasked: "77•••••67" };
const merchant = {
  id: "m1",
  slug: "awa-beaute",
  displayName: "Awa Beauté",
  category: "beaute",
  qrUrl: "http://127.0.0.1:4173/p/awa-beaute",
};
const session = { expiresAt: "2099-01-01T00:00:00.000Z" };

type PayMethod = "wave" | "orange" | "yas" | "expresso";

type Invoice = {
  id: string;
  status: "pending" | "paid";
  amountXof: number;
  amountSats: number;
  bolt11: string | null;
  expiresAt: string;
  paidAt: string | null;
  label: string | null;
  channel: "dynamic" | "static_qr";
  source: "live" | "seed";
  paymentHash: string | null;
  demoPayment?: boolean;
  payUrl?: string;
  payMethod?: PayMethod | null;
  payStartedAt?: number;
  createdAtMs: number;
};

async function mockApi(page: Page, options?: { manualDemo?: boolean }) {
  const manualDemo = options?.manualDemo ?? false;
  const invoices = new Map<string, Invoice>();
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const send = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/api/health") return send(200, { ok: true, bitnob: true });
    if (path === "/api/auth/me") return send(200, { user, merchant, session });
    if (path === "/api/auth/logout" && method === "POST") return route.fulfill({ status: 204, body: "" });
    if (path === "/api/auth/register" && method === "POST") {
      return send(201, { token: "tok-register", expiresAt: session.expiresAt, user, merchant });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const body = request.postDataJSON() as { pin?: string };
      if (body.pin !== "482915") {
        return send(401, {
          error: "INVALID_CREDENTIALS",
          message: "Code incorrect · encore 4 essais",
          attemptsLeft: 4,
        });
      }
      return send(200, { token: "tok-login", expiresAt: session.expiresAt, user, merchant });
    }
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
      if (!request.headers()["idempotency-key"]) {
        return send(400, { error: "VALIDATION", message: "Clé d'idempotence manquante" });
      }
      const body = request.postDataJSON() as { amountXof: number; label?: string };
      const invoice = makeInvoice("inv-comptoir", body.amountXof, body.label ?? null, "dynamic", manualDemo);
      invoices.set(invoice.id, invoice);
      return send(201, { invoice: publicView(invoice) });
    }
    if (path === "/api/public/shops/awa-beaute") return send(200, { name: "Awa Beauté", category: "beaute" });
    if (path === "/api/public/invoices" && method === "POST") {
      const body = request.postDataJSON() as { amountXof: number };
      const invoice = makeInvoice("inv-client", body.amountXof, null, "static_qr", manualDemo);
      invoices.set(invoice.id, invoice);
      return send(201, { invoice: publicView(invoice) });
    }
    const demoPay = path.match(/^\/api\/public\/invoices\/([^/]+)\/pay$/);
    if (demoPay && method === "POST") {
      const invoice = invoices.get(demoPay[1]!);
      if (!invoice) return send(404, { error: "NOT_FOUND", message: "Facture introuvable" });
      const body = request.postDataJSON() as { method?: PayMethod };
      invoice.payMethod = body.method ?? null;
      invoice.payStartedAt = Date.now();
      return send(200, publicPoll(advance(invoice)));
    }
    const merchantInvoice = path.match(/^\/api\/invoices\/([^/]+)$/);
    if (merchantInvoice && method === "GET") return send(200, { invoice: advance(invoices.get(merchantInvoice[1]!)) });
    const publicInvoice = path.match(/^\/api\/public\/invoices\/([^/]+)$/);
    if (publicInvoice && method === "GET") {
      return send(200, publicPoll(advance(invoices.get(publicInvoice[1]!))));
    }
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
    if (path === "/api/sales") return send(200, { items: [] });
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
    if (path === "/api/balance") {
      return send(200, { balanceXof: 0, balanceSats: 0, lastPayouts: [] });
    }
    return send(404, { error: "NOT_FOUND", message: `Route absente du mock : ${method} ${path}` });
  });
}

function makeInvoice(
  id: string,
  amountXof: number,
  label: string | null,
  channel: Invoice["channel"] = "dynamic",
  manualDemo = false,
): Invoice {
  return {
    id,
    status: "pending",
    amountXof,
    amountSats: 4230,
    bolt11: manualDemo ? null : "lntb1demo",
    expiresAt: "2099-01-01T00:15:00.000Z",
    paidAt: null,
    label,
    channel,
    source: "live",
    paymentHash: null,
    ...(manualDemo
      ? {
          demoPayment: true,
          payUrl: `http://127.0.0.1:4173/p/awa-beaute?facture=${id}`,
          payMethod: null,
        }
      : {}),
    createdAtMs: Date.now(),
  };
}

function publicView(invoice: Invoice) {
  const { createdAtMs: _createdAtMs, payStartedAt: _payStartedAt, ...view } = invoice;
  return view;
}

function publicPoll(invoice: Invoice) {
  if (!invoice.demoPayment) {
    return { status: invoice.status, amountXof: invoice.amountXof, expiresAt: invoice.expiresAt };
  }
  return {
    status: invoice.status,
    amountXof: invoice.amountXof,
    expiresAt: invoice.expiresAt,
    demoPayment: true,
    payMethod: invoice.payMethod ?? null,
  };
}

function advance(invoice: Invoice | undefined) {
  if (!invoice) {
    throw new Error("Facture inconnue");
  }
  if (invoice.demoPayment) {
    if (invoice.payMethod && invoice.payStartedAt !== undefined && Date.now() - invoice.payStartedAt >= 800) {
      invoice.status = "paid";
      invoice.paidAt = "2026-10-17T18:42:00.000Z";
    }
    return publicView(invoice);
  }
  if (Date.now() - invoice.createdAtMs >= 1200) {
    invoice.status = "paid";
    invoice.paidAt = "2026-10-17T18:42:00.000Z";
    invoice.paymentHash = "a1b2c3d4e5f6";
  }
  return publicView(invoice);
}

async function seedSession(page: Page) {
  await page.addInitScript(
    ({ storedUser, storedMerchant, expiresAt }) => {
      localStorage.setItem("jk.session", JSON.stringify({ token: "tok", expiresAt }));
      localStorage.setItem("jk.profile", JSON.stringify({ user: storedUser, merchant: storedMerchant }));
      localStorage.setItem("jk.installLater", "1");
    },
    { storedUser: user, storedMerchant: merchant, expiresAt: session.expiresAt },
  );
}

async function typePin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("parcours 1 : installer, créer la boutique, arriver à encaisser", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Installer Jaaykat" })).toBeVisible();
  await page.getByRole("button", { name: "Plus tard" }).click();
  await page.getByLabel("Nom de la boutique").fill("Awa Beauté");
  await page.getByLabel("Catégorie").selectOption("beaute");
  await page.getByLabel("Prénom").fill("Awa");
  await page.getByLabel("Nom", { exact: true }).fill("Diop");
  await page.getByLabel("Téléphone").fill("77 123 45 67");
  await page.getByRole("checkbox", { name: "J'accepte les conditions de la démo" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await typePin(page, "482915");
  await expect(page.getByText("Confirmez le code")).toBeVisible();
  await typePin(page, "482915");
  await expect(page.getByText("Boutique créée")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Encaisser" })).toBeVisible();
});

test("parcours 1b : déconnexion puis connexion, PIN refusé puis accepté", async ({ page }) => {
  await seedSession(page);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
  await page.getByLabel("Téléphone").fill("771234567");
  await typePin(page, "111222");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Code incorrect · encore 4 essais")).toBeVisible();
  await typePin(page, "482915");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Encaisser" })).toBeVisible();
});

test("parcours 2 : 2 500 F, QR, paiement simulé, écran payé", async ({ page }) => {
  await seedSession(page);
  await page.goto("/app/charge");
  await page.getByRole("button", { name: /2\s500/ }).click();
  await page.getByRole("button", { name: "Générer le QR" }).click();
  await expect(page.getByText("En attente du paiement")).toBeVisible();
  await expect(page.getByText("Mode démo · sandbox, aucune somme réelle")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR de la facture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payé" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Nouvelle vente" }).click();
  await expect(page.getByRole("heading", { name: "Encaisser" })).toBeVisible();
});

test("parcours démo : scan du QR, choix Wave, paiement reçu", async ({ page }) => {
  await page.unroute("**/api/**");
  await mockApi(page, { manualDemo: true });
  await seedSession(page);
  await page.goto("/app/charge");
  await page.getByRole("button", { name: /2\s500/ }).click();
  await page.getByRole("button", { name: "Générer le QR" }).click();
  await expect(page.getByText("En attente du client")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR de la facture" })).toBeVisible();
  await expect(page.getByText("Confirmation automatique en ~5 s.")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "Payé" })).toHaveCount(0);
  await page.goto("/p/awa-beaute?facture=inv-comptoir");
  await expect(page.getByRole("heading", { name: "Awa Beauté" })).toBeVisible();
  await expect(page.getByText("Démo : paiement simulé, aucune somme réelle")).toBeVisible();
  await page.getByRole("button", { name: /^Wave/ }).click();
  await page.getByRole("button", { name: /Confirmer le paiement de/ }).click();
  await expect(page.getByRole("heading", { name: "Paiement en cours" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 10_000 });
  await page.goto("/app/invoice/inv-comptoir");
  await expect(page.getByRole("heading", { name: "Payé" })).toBeVisible({ timeout: 10_000 });
});

test("parcours 3 : le client paie depuis l'affiche et le marchand voit Payé", async ({ page }) => {
  await page.goto("/p/awa-beaute");
  await expect(page.getByRole("heading", { name: "Awa Beauté" })).toBeVisible();
  for (const digit of ["2", "5", "0", "0"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Payer" }).click();
  await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 10_000 });

  await seedSession(page);
  await page.goto("/app/invoice/inv-client");
  await expect(page.getByRole("heading", { name: "Payé" })).toBeVisible({ timeout: 10_000 });
});

test("parcours 7 : hors ligne, lecture du tableau, encaissement bloqué", async ({ page }) => {
  await seedSession(page);
  await page.goto("/app/dashboard");
  await expect(page.getByText("12 500 F").first()).toBeVisible();
  await expect(page.getByText("Montrez le QR de plus près.")).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByText(/Hors ligne/)).toBeVisible();
  await page.getByRole("link", { name: "Encaisser" }).click();
  await expect(page.getByText("Il faut du réseau pour encaisser.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Générer le QR" })).toBeDisabled();
});

test("tableau et score affichent les chiffres de l'API", async ({ page }) => {
  await seedSession(page);
  await page.goto("/app/score");
  await expect(page.getByText("Score indicatif, non utilisé pour un prêt.")).toBeVisible();
  await expect(page.getByText("Bande B")).toBeVisible();
  await page.getByRole("link", { name: "Tableau" }).click();
  await expect(page.getByText("Vos clients paient en 9 s.")).toBeVisible();
});
