import { expect, test } from "@playwright/test";
import { mockApi, seedSession } from "./mock";

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
  const dir = "test-results/screenshots";
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
