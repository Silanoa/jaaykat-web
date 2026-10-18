import { expect, test, type Page } from "@playwright/test";
import { mockApi, seedSession } from "./mock";

const shots = process.env.JK_SHOTS_DIR ?? "test-results/screenshots";
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const components = [
  { key: "regularity", value: 0.76 },
  { key: "growth", value: 0.6 },
  { key: "volume", value: 0.92 },
  { key: "loyalty", value: 0.45 },
  { key: "quality", value: 0.88 },
];

function scoreBody(extra: Record<string, unknown>) {
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

function attestationBody(extra: Record<string, unknown> = {}) {
  return {
    attestationId: "JK-7KQ2-M9XA",
    shopName: "Chez Awa",
    status: "valid",
    issuedAt: "2026-10-17T18:00:00.000Z",
    expiresAt: "2026-10-24T18:00:00.000Z",
    demo: false,
    environment: "sandbox",
    windowDays: 90,
    score: 71,
    band: "B",
    period: { from: "2026-09-27", to: "2026-10-17" },
    salesCount: 25,
    totalXof: 62_500,
    ...extra,
  };
}

async function override(page: Page, path: string, body: unknown) {
  await page.route(`**${path}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
}

async function settled(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

for (const viewport of VIEWPORTS) {
  test(`retrait ${viewport.name} : vignettes avec logos, zones tactiles, sélection sans décalage`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedSession(page);
    await page.goto("/app/payout");
    const group = page.getByRole("group", { name: "Réseau" });
    await expect(group).toBeVisible();
    const names = ["Wave", "Orange Money", "Yas", "Expresso"];
    const tiles = names.map((name) => group.getByRole("radio", { name }).locator("xpath=ancestor::label"));
    for (const tile of tiles) {
      const box = await tile.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.width).toBeGreaterThanOrEqual(48);
      const image = tile.locator("img");
      const rendered = await tile.locator("[data-pay-logo]").boundingBox();
      expect(Math.round(rendered!.width)).toBe(44);
      expect(Math.round(rendered!.height)).toBe(44);
      expect(await image.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await expect(image).toHaveAttribute("alt", /^Logo /);
    }
    await settled(page);
    const phone = page.getByLabel("Numéro");
    const before = [...(await Promise.all(tiles.map((tile) => tile.boundingBox()))), await phone.boundingBox()];
    await tiles[2]!.click();
    await expect(tiles[2]!).toHaveAttribute("data-selected", "true");
    await expect(tiles[0]!).toHaveAttribute("data-selected", "false");
    const after = [...(await Promise.all(tiles.map((tile) => tile.boundingBox()))), await phone.boundingBox()];
    expect(after).toEqual(before);
    await noHorizontalOverflow(page);
    await settled(page);
    await page.screenshot({ path: `${shots}/retrait-${viewport.name}.png`, fullPage: true });
  });

  test(`attestation publique ${viewport.name} : périmètre, identifiant, limites, pas de numéro`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.width === 390 ? 2000 : 1500 });
    await override(page, "/api/public/shares/tok", attestationBody());
    await page.goto("/s/tok");
    await expect(page.getByRole("heading", { name: "Chez Awa" })).toBeVisible();
    await expect(page.getByText("JK-7KQ2-M9XA")).toBeVisible();
    await expect(page.getByText("71 / 100")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ce qu'elle n'atteste pas" })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code de vérification/ })).toBeVisible();
    await expect(page.getByText(/Réseau de test Bitnob/)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/\+221|\b77\d{7}\b/);
    await noHorizontalOverflow(page);
    await settled(page);
    await page.screenshot({ path: `${shots}/attestation-${viewport.name}.png`, fullPage: true });
  });
}

test("attestation de démonstration 390 : étiquetée", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 2000 });
  await override(page, "/api/public/shares/tok", attestationBody({ demo: true, shopName: "Awa Beauté", environment: "mock" }));
  await page.goto("/s/tok");
  await expect(page.getByText(/Démonstration : calculée sur un historique de ventes simulé/)).toBeVisible();
  await settled(page);
    await page.screenshot({ path: `${shots}/attestation-demo-390.png`, fullPage: true });
});

for (const viewport of VIEWPORTS) {
  test(`score ${viewport.name} inéligible : bouton désactivé avec explication`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await override(
      page,
      "/api/score",
      scoreBody({ score: null, band: null, eligible: false, remaining: { days: 9, sales: 14 }, progress: { daysSinceFirst: 5, salesCount: 6 } }),
    );
    await seedSession(page);
    await page.goto("/app/score");
    const button = page.getByRole("button", { name: "Partager mon attestation" }).locator("visible=true");
    await expect(button).toBeDisabled();
    await expect(page.getByText("Attestation indisponible. Encore 14 ventes payées et 9 jours pour être éligible.").locator("visible=true")).toBeVisible();
    await noHorizontalOverflow(page);
    await settled(page);
    await page.screenshot({ path: `${shots}/score-inegible-${viewport.name}.png`, fullPage: true });
  });
}

test("solde 390 : solde retirable et chiffre d'affaires de démonstration séparés", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await override(page, "/api/balance", { balanceXof: 0, balanceSats: 0, demoRevenueXof: 187_500, demoSalesCount: 74, lastPayouts: [] });
  await seedSession(page);
  await page.goto("/app/balance");
  await expect(page.getByText("Solde retirable", { exact: true })).toBeVisible();
  await expect(page.getByText("Chiffre d'affaires de démonstration")).toBeVisible();
  await expect(page.getByText(/Non retirable/)).toBeVisible();
  await settled(page);
    await page.screenshot({ path: `${shots}/solde-demo-390.png`, fullPage: true });
});
