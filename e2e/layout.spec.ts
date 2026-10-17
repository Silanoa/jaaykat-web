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

async function mockApi(page: Page) {
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

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("bureau 1440 : barre latérale visible, onglets absents", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedSession(page);
  await page.goto("/app/charge");
  await expect(page.getByRole("heading", { name: "Encaisser" })).toBeVisible();
  const sidebar = page.locator('nav[aria-label="Espace marchand"]');
  const tabs = page.locator('nav[aria-label="Navigation principale"]');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Retirer" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Déconnexion" })).toBeVisible();
  await expect(tabs).toBeHidden();
});

test("mobile 390 : onglets visibles, barre latérale absente", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSession(page);
  await page.goto("/app/dashboard");
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  const sidebar = page.locator('nav[aria-label="Espace marchand"]');
  const tabs = page.locator('nav[aria-label="Navigation principale"]');
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Encaisser" })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Montant" })).toHaveCount(0);
});

test("la page client reste une colonne étroite en 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/p/awa-beaute");
  await expect(page.getByRole("heading", { name: "Awa Beauté" })).toBeVisible();
  await expect(page.locator('nav[aria-label="Espace marchand"]')).toHaveCount(0);
  const box = await page.getByRole("heading", { name: "Awa Beauté" }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThan(400);
  expect(box!.x + box!.width).toBeLessThan(1040);
});

test("connexion en 1440 : panneau de marque et formulaire en deux colonnes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/login");
  const heading = page.getByRole("heading", { name: "Se connecter" });
  await expect(heading).toBeVisible();
  const brand = page.getByTestId("auth-brand");
  await expect(brand).toBeVisible();
  const brandBox = await brand.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(brandBox!.x).toBe(0);
  expect(brandBox!.width).toBeGreaterThan(500);
  expect(brandBox!.height).toBeGreaterThanOrEqual(880);
  expect(headingBox!.x).toBeGreaterThan(brandBox!.width);
  expect(headingBox!.x + headingBox!.width).toBeLessThan(1440);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/connexion-1440.png", fullPage: true });
});

test("installation, inscription et PIN oublié gardent le panneau de marque en 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, title] of [
    ["/app/install", "Installer Jaaykat"],
    ["/app/register", "Créer ma boutique"],
    ["/app/forgot", "PIN oublié"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByTestId("auth-brand")).toBeVisible();
  }
  await page.screenshot({ path: "test-results/forgot-1440.png", fullPage: true });
});

test("connexion en 390 : pas de panneau de marque, colonne unique", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/login");
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByTestId("auth-brand")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("captures des écrans marchand en 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedSession(page);
  const dir = "/opt/cursor/artifacts/screenshots";
  await page.goto("/app/charge");
  await expect(page.locator('nav[aria-label="Espace marchand"]')).toBeVisible();
  await page.screenshot({ path: `${dir}/encaisser.png`, fullPage: true });

  await page.getByRole("button", { name: /2\s500/ }).click();
  await page.getByRole("button", { name: "Générer le QR" }).click();
  await expect(page.getByText("En attente du paiement")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR de la facture" })).toBeVisible();
  await page.screenshot({ path: `${dir}/facture.png`, fullPage: true });

  await page.goto("/app/sales");
  await expect(page.getByRole("columnheader", { name: "Montant" })).toBeVisible();
  await page.screenshot({ path: `${dir}/ventes.png`, fullPage: true });

  await page.goto("/app/dashboard");
  await expect(page.getByText("Vos clients paient en 9 s.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ventes" })).toBeVisible();
  const revenue = await page.getByText("Chiffre d'affaires").boundingBox();
  const basket = await page.getByText("Panier moyen").boundingBox();
  const bestDay = await page.getByText("Meilleur jour").boundingBox();
  expect(revenue && basket && bestDay).toBeTruthy();
  expect(Math.abs(revenue!.y - basket!.y)).toBeLessThan(80);
  expect(Math.abs(basket!.y - bestDay!.y)).toBeLessThan(80);
  expect(revenue!.x).toBeLessThan(basket!.x);
  expect(basket!.x).toBeLessThan(bestDay!.x);
  await page.screenshot({ path: `${dir}/tableau.png`, fullPage: true });

  await page.goto("/app/score");
  await expect(page.getByRole("heading", { name: "Attestation" })).toBeVisible();
  await page.screenshot({ path: `${dir}/score.png`, fullPage: true });

  await page.goto("/app/payout");
  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await page.screenshot({ path: `${dir}/retirer.png`, fullPage: true });

  await page.goto("/app/balance");
  await expect(page.getByRole("heading", { name: "Solde" })).toBeVisible();
  await page.screenshot({ path: `${dir}/solde.png`, fullPage: true });
});
