import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./mock";

declare global {
  interface Window {
    __retrySeen?: boolean;
  }
}

async function watchRetry(page: Page) {
  await page.addInitScript(() => {
    const check = () => {
      if (/Réessay/.test(document.body?.textContent ?? "")) window.__retrySeen = true;
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

async function retrySeen(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__retrySeen === true);
}

async function confirmWave(page: Page) {
  await page.goto("/p/awa-beaute?facture=inv-client");
  await page.getByRole("button", { name: /^Wave/ }).click();
  await page.getByRole("button", { name: /Confirmer le paiement de/ }).click();
}

test.use({ viewport: { width: 390, height: 844 } });

test("passe tout de suite à Paiement en cours quand /pay est lent, sans Réessayer", async ({ page }) => {
  const mock = await mockApi(page);
  await watchRetry(page);
  let posts = 0;
  await page.route("**/api/public/invoices/inv-client/pay", async (route) => {
    posts += 1;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fallback();
  });
  await confirmWave(page);
  await expect(page.getByRole("heading", { name: "Paiement en cours" })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole("button", { name: "Confirmer le paiement de 2 500 F" })).toHaveCount(0);
  await page.waitForTimeout(3300);
  mock.pub.status = "paid";
  await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 8000 });
  expect(posts).toBe(1);
  expect(await retrySeen(page)).toBe(false);
});

test("tolère un 429 puis un 200 sur le polling sans changer d'écran", async ({ page }) => {
  const mock = await mockApi(page);
  await watchRetry(page);
  let after = 0;
  await page.route("**/api/public/invoices/inv-client", async (route) => {
    if (mock.pub.payMethod === null) return route.fallback();
    after += 1;
    if (after <= 5) {
      return route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez dans un instant.", retryAfterSeconds: 30 }),
      });
    }
    return route.fallback();
  });
  await confirmWave(page);
  await expect(page.getByRole("heading", { name: "Paiement en cours" })).toBeVisible({ timeout: 1000 });
  await expect.poll(() => after, { timeout: 10_000 }).toBeGreaterThan(5);
  await expect(page.getByRole("heading", { name: "Paiement en cours" })).toBeVisible();
  mock.pub.status = "paid";
  await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 8000 });
  expect(await retrySeen(page)).toBe(false);
});

test("tolère une coupure réseau et un 500 transitoires sur le polling", async ({ page }) => {
  const mock = await mockApi(page);
  await watchRetry(page);
  let after = 0;
  await page.route("**/api/public/invoices/inv-client", async (route) => {
    if (mock.pub.payMethod === null) return route.fallback();
    after += 1;
    if (after <= 2) return route.abort("connectionreset");
    if (after === 3) {
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "INTERNAL", message: "Une erreur est survenue." }) });
    }
    return route.fallback();
  });
  await confirmWave(page);
  await expect(page.getByRole("heading", { name: "Paiement en cours" })).toBeVisible({ timeout: 1000 });
  await expect.poll(() => after, { timeout: 10_000 }).toBeGreaterThan(3);
  mock.pub.status = "paid";
  await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 8000 });
  expect(await retrySeen(page)).toBe(false);
});
