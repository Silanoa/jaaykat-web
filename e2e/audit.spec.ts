import { expect, test, type Page } from "@playwright/test";
import { mockApi, seedSession, type PublicInvoiceMock } from "./mock";

const widths = [320, 360, 390, 768, 1024, 1440, 1920];

type Screen = {
  name: string;
  path: string;
  ready: (page: Page) => Promise<void>;
  auth: boolean;
  setup?: (pub: PublicInvoiceMock) => void;
  after?: (page: Page) => Promise<void>;
};

const heading = (name: string | RegExp) => async (page: Page) => {
  await expect(page.getByRole("heading", { name }).first()).toBeVisible();
};

const screens: Screen[] = [
  { name: "connexion", path: "/app/login", auth: false, ready: heading("Se connecter") },
  { name: "inscription", path: "/app/register", auth: false, ready: heading(/Cr.er ma boutique/) },
  { name: "encaisser", path: "/app/charge", auth: true, ready: heading("Encaisser") },
  { name: "facture", path: "/app/invoice/inv-bureau", auth: true, ready: async (p) => { await expect(p.getByText("En attente du paiement")).toBeVisible(); } },
  { name: "facture-payee", path: "/app/invoice/inv-paid", auth: true, ready: heading("Pay\u00e9") },
  { name: "tableau", path: "/app/dashboard", auth: true, ready: async (p) => { await expect(p.getByText("Vos clients paient en 9 s.")).toBeVisible(); } },
  { name: "ventes", path: "/app/sales", auth: true, ready: async (p) => { await expect(p.getByText("Fatou").locator("visible=true").first()).toBeVisible(); } },
  { name: "score", path: "/app/score", auth: true, ready: async (p) => { await expect(p.getByText("Partager mon attestation").locator("visible=true").first()).toBeVisible(); } },
  { name: "solde", path: "/app/balance", auth: true, ready: heading("Solde") },
  { name: "retirer", path: "/app/payout", auth: true, ready: heading("Retrait") },
  { name: "qr", path: "/app/qr", auth: true, ready: async (p) => { await expect(p.getByRole("img").first()).toBeVisible(); } },
  { name: "introuvable", path: "/app/nexiste-pas", auth: true, ready: async (p) => { await expect(p.locator("main, body").first()).toBeVisible(); } },
  { name: "boutique", path: "/p/awa-beaute", auth: false, ready: heading("Awa Beaut\u00e9") },
  { name: "client-choix", path: "/p/awa-beaute?facture=inv-client", auth: false, ready: async (p) => { await expect(p.getByRole("button", { name: /^Wave/ })).toBeVisible(); } },
  {
    name: "client-confirmer",
    path: "/p/awa-beaute?facture=inv-client",
    auth: false,
    ready: async (p) => { await expect(p.getByRole("heading", { name: "Confirmer le paiement" })).toBeVisible(); },
    after: async (p) => { await p.getByRole("button", { name: /^Wave/ }).click(); },
  },
  {
    name: "client-en-cours",
    path: "/p/awa-beaute?facture=inv-client",
    auth: false,
    ready: async (p) => { await expect(p.getByRole("heading", { name: "Paiement en cours" })).toBeVisible(); },
    after: async (p) => {
      await p.getByRole("button", { name: /^Wave/ }).click();
      await p.getByRole("button", { name: /Confirmer le paiement de/ }).click();
    },
  },
  {
    name: "client-lightning",
    path: "/p/awa-beaute?facture=inv-client",
    auth: false,
    ready: async (p) => { await expect(p.getByRole("link", { name: "Ouvrir mon portefeuille" })).toBeVisible(); },
    after: async (p) => {
      await p.getByRole("button", { name: /^Portefeuille Lightning/ }).click();
      await p.getByRole("button", { name: /Confirmer le paiement de/ }).click();
    },
  },
  {
    name: "client-paye",
    path: "/p/awa-beaute?facture=inv-client",
    auth: false,
    setup: (pub) => { pub.status = "paid"; pub.payMethod = "wave"; },
    ready: async (p) => { await expect(p.getByRole("heading", { name: "Paiement re\u00e7u" })).toBeVisible(); },
  },
];

type Finding = { screen: string; width: number; kind: string; detail: string };

async function inspect(page: Page, screen: string, width: number): Promise<Finding[]> {
  return page.evaluate(
    ({ screen, width }) => {
      const out: { screen: string; width: number; kind: string; detail: string }[] = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) {
        const wide = Array.from(document.querySelectorAll("body *"))
          .filter((e) => e.getBoundingClientRect().right > doc.clientWidth + 1)
          .slice(0, 3)
          .map((e) => `${e.tagName.toLowerCase()}.${e.className.toString().slice(0, 60)}`)
          .join(" ; ");
        out.push({ screen, width, kind: "scroll-horizontal", detail: `${doc.scrollWidth} > ${doc.clientWidth} ${wide}` });
      }
      const describe = (el: Element) => {
        const text = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ");
        return `${el.tagName.toLowerCase()}[${text.slice(0, 40)}]`;
      };
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0;
      };
      const targets = Array.from(document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")).filter(visible);
      for (const el of targets) {
        const field = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
        const r = (field ? el.closest("label") ?? el : el).getBoundingClientRect();
        const dense = el.hasAttribute("data-dense");
        const inline = el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline";
        if (dense ? r.height < 24 || r.width < 24 : !inline && (r.height < 44 || r.width < 44)) {
          out.push({ screen, width, kind: "cible-tactile", detail: `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}` });
        }
        if (!el.closest(".overflow-x-auto") && (r.right > window.innerWidth + 1 || r.left < -1)) {
          out.push({ screen, width, kind: "hors-ecran", detail: describe(el) });
        }
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 16) out.push({ screen, width, kind: "texte-champ<16", detail: `${describe(el)} ${size}px` });
        }
      }
      for (let i = 0; i < targets.length; i += 1) {
        for (let j = i + 1; j < targets.length; j += 1) {
          const a = targets[i];
          const b = targets[j];
          if (a.contains(b) || b.contains(a)) continue;
          if (Boolean(a.closest("nav, [data-fixed]")) !== Boolean(b.closest("nav, [data-fixed]"))) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > 2 && h > 2) out.push({ screen, width, kind: "chevauchement", detail: `${describe(a)} / ${describe(b)}` });
        }
      }
      const he0 = (e: Element) => e.getBoundingClientRect().width <= 1 || e.className.toString().includes("sr-only");
      const texts = Array.from(document.querySelectorAll("p, span, li, h1, h2, h3, label, a, button")).filter(visible);
      for (const el of texts) {
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0);
        if (!own) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (he0(el)) continue;
        if (size < 12) out.push({ screen, width, kind: "texte<12", detail: `${describe(el)} ${size}px` });
        const he = el as HTMLElement;
        if (he.scrollWidth > he.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible" && getComputedStyle(el).overflowX !== "auto") {
          out.push({ screen, width, kind: "texte-coupe", detail: describe(el) });
        }
      }
      return out;
    },
    { screen, width },
  );
}

test.describe("audit responsive", () => {
  for (const width of widths) {
    test(`largeur ${width}`, async ({ page }) => {
      test.setTimeout(180_000);
      const height = width >= 1024 ? 900 : 844;
      await page.setViewportSize({ width, height });
      const findings: Finding[] = [];
      const { pub } = await mockApi(page);
      await seedSession(page);
      for (const screen of screens) {
        pub.status = "pending";
        pub.payMethod = null;
        delete pub.bolt11;
        screen.setup?.(pub);
        await page.goto(screen.path);
        if (screen.after) await screen.after(page);
        await screen.ready(page);
        await page.waitForTimeout(450);
        await page.screenshot({ path: `test-results/audit/${screen.name}-${width}.png`, fullPage: true });
        findings.push(...(await inspect(page, screen.name, width)));
      }
      const lines = findings.map((f) => `${f.kind}\t${f.screen}\t${f.width}\t${f.detail}`);
      console.log(`AUDIT ${width}: ${findings.length}\n${lines.join("\n")}`);
      expect(findings, lines.join("\n")).toEqual([]);
    });
  }
});
