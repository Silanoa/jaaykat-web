import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderAt, routeFetch } from "../test/render";

const merchant = {
  id: "m1",
  slug: "awa-beaute",
  displayName: "Awa Beauté",
  category: "beaute",
  qrUrl: "https://demo.example/p/awa-beaute",
};

const me = {
  user: { id: "u1", phoneMasked: "77•••••67" },
  merchant,
  session: { expiresAt: "2099-01-01T00:00:00.000Z" },
};

function invoice(status: "pending" | "paid") {
  return {
    invoice: {
      id: status === "paid" ? "inv-paid" : "inv-wait",
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

describe("états des écrans", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("affiche le blocage du compte au login", async () => {
    renderAt(
      "/app/login",
      routeFetch({
        "/api/auth/login": () =>
          jsonResponse(423, {
            error: "LOCKED",
            message: "Trop d'essais. Réessayez dans 14 min",
            retryAfterSeconds: 840,
          }),
      }),
    );
    await userEvent.type(screen.getByLabelText("Téléphone"), "771234567");
    await userEvent.click(screen.getByRole("button", { name: "1" }));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await userEvent.click(screen.getByRole("button", { name: "4" }));
    await userEvent.click(screen.getByRole("button", { name: "5" }));
    await userEvent.click(screen.getByRole("button", { name: "6" }));
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Trop d'essais. Réessayez dans 14 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeDisabled();
  });

  it("désactive l'encaissement hors ligne", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderAt("/app/charge", routeFetch({ "/api/auth/me": () => jsonResponse(200, me) }), true);
    expect(await screen.findByText("Il faut du réseau pour encaisser.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Générer le QR" })).toBeDisabled();
  });

  it("laisse le bouton désactivé tant que le montant est à zéro", async () => {
    renderAt(
      "/app/charge",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/rates": () =>
          jsonResponse(200, {
            btcXof: 60000000,
            btcUsd: 100000,
            usdXof: 600,
            ts: "2026-10-17T18:00:00.000Z",
            validFor: 60,
            source: "sandbox",
          }),
      }),
      true,
    );
    const button = await screen.findByRole("button", { name: "Générer le QR" });
    expect(button).toBeDisabled();
    expect(screen.getByText("0 F")).toBeInTheDocument();
  });

  it("affiche l'attente sans conclure au paiement", async () => {
    renderAt(
      "/app/invoice/inv-wait",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/invoices/inv-wait": () => jsonResponse(200, invoice("pending")),
      }),
      true,
    );
    expect(await screen.findByText("En attente du paiement")).toBeInTheDocument();
    expect(screen.getByText("Paiement simulé · sandbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouvelle vente" })).not.toBeInTheDocument();
  });

  it("affiche l'attente client quand la facture a un payUrl", async () => {
    renderAt(
      "/app/invoice/inv-demo",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/invoices/inv-demo": () =>
          jsonResponse(200, {
            invoice: {
              ...invoice("pending").invoice,
              id: "inv-demo",
              bolt11: null,
              demoPayment: true,
              payUrl: "https://demo.example/p/awa-beaute?facture=inv-demo",
              payMethod: null,
            },
          }),
      }),
      true,
    );
    expect(await screen.findByText("En attente du client")).toBeInTheDocument();
    expect(screen.queryByText("Confirmation automatique en ~5 s.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Payé" })).not.toBeInTheDocument();
  });

  it("laisse le client choisir Wave puis affiche reçu seulement après l'API", async () => {
    let submitted = false;
    let pollsAfterPay = 0;
    const user = userEvent.setup();
    renderAt("/p/awa-beaute?facture=inv-demo", async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
      if (path === "/api/health") return jsonResponse(200, { ok: true });
      if (path === "/api/public/shops/awa-beaute") {
        return jsonResponse(200, { name: "Awa Beauté", category: "beaute" });
      }
      if (path === "/api/public/invoices/inv-demo/pay") {
        const body = JSON.parse(String(init?.body)) as { method?: string };
        expect(body.method).toBe("wave");
        submitted = true;
        return jsonResponse(200, {
          status: "pending",
          amountXof: 2500,
          expiresAt: "2099-01-01T00:15:00.000Z",
          demoPayment: true,
          payMethod: "wave",
        });
      }
      if (path === "/api/public/invoices/inv-demo") {
        if (submitted) pollsAfterPay += 1;
        const settled = pollsAfterPay > 0;
        return jsonResponse(200, {
          status: settled ? "paid" : "pending",
          amountXof: 2500,
          expiresAt: "2099-01-01T00:15:00.000Z",
          demoPayment: true,
          payMethod: settled ? "wave" : null,
        });
      }
      return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    });
    expect(await screen.findByText("Démo : paiement simulé, aucune somme réelle")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Awa Beauté" })).toBeInTheDocument();
    expect(screen.getByText(/2\s500\sF/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payer avec Wave" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Payer avec Orange Money" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Payer avec Free Money" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Payer avec Expresso" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Payer avec Wave" }));
    expect(await screen.findByRole("heading", { name: "Paiement en cours" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Paiement reçu" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Paiement reçu" }, { timeout: 5000 })).toBeInTheDocument();
  });

  it("n'annonce pas de confirmation automatique dans l'aide quand le paiement est simulé", async () => {
    renderAt("/p/awa-beaute?aide=1", async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
      if (path === "/api/health") return jsonResponse(200, { ok: true, bitnob: true, demoPayMode: "manual" });
      return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    });
    expect(await screen.findByText(/vous choisissez Wave, Orange Money, Free Money ou Expresso/)).toBeInTheDocument();
    expect(screen.queryByText(/toute seule/)).not.toBeInTheDocument();
    expect(screen.queryByText(/portefeuille/)).not.toBeInTheDocument();
  });

  it("garde l'explication Lightning dans l'aide hors paiement simulé", async () => {
    renderAt("/p/awa-beaute?aide=1", async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
      if (path === "/api/health") return jsonResponse(200, { ok: true, bitnob: true, demoPayMode: "auto" });
      return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    });
    expect(await screen.findByText(/La confirmation se fait toute seule/)).toBeInTheDocument();
    expect(screen.getByText(/application de portefeuille/)).toBeInTheDocument();
  });

  it("après la saisie du montant, ouvre le même choix en mode démo", async () => {
    const user = userEvent.setup();
    renderAt("/p/awa-beaute", async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
      if (path === "/api/health") return jsonResponse(200, { ok: true });
      if (path === "/api/public/shops/awa-beaute") {
        return jsonResponse(200, { name: "Awa Beauté", category: "beaute" });
      }
      if (path === "/api/public/invoices" && (init?.method ?? "GET") === "POST") {
        return jsonResponse(201, {
          invoice: {
            id: "inv-saisie",
            status: "pending",
            amountXof: 1500,
            amountSats: 0,
            bolt11: null,
            expiresAt: "2099-01-01T00:15:00.000Z",
            paidAt: null,
            label: null,
            channel: "static_qr",
            source: "live",
            demoPayment: true,
            payUrl: "https://demo.example/p/awa-beaute?facture=inv-saisie",
            payMethod: null,
          },
        });
      }
      if (path === "/api/public/invoices/inv-saisie") {
        return jsonResponse(200, {
          status: "pending",
          amountXof: 1500,
          expiresAt: "2099-01-01T00:15:00.000Z",
          demoPayment: true,
          payMethod: null,
        });
      }
      return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    });
    expect(await screen.findByRole("heading", { name: "Awa Beauté" })).toBeInTheDocument();
    for (const digit of ["1", "5", "0", "0"]) {
      await user.click(screen.getByRole("button", { name: new RegExp(`^${digit}$`) }));
    }
    await user.click(screen.getByRole("button", { name: "Payer" }));
    expect(await screen.findByRole("button", { name: "Payer avec Wave" })).toBeInTheDocument();
    expect(screen.getByText("Démo : paiement simulé, aucune somme réelle")).toBeInTheDocument();
  });

  it("affiche l'écran payé quand l'API renvoie paid", async () => {
    renderAt(
      "/app/invoice/inv-paid",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/invoices/inv-paid": () => jsonResponse(200, invoice("paid")),
      }),
      true,
    );
    expect(await screen.findByRole("heading", { name: "Payé" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nouvelle vente" })).toBeEnabled();
  });

  it("affiche l'état vide des ventes", async () => {
    renderAt(
      "/app/sales",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/sales": () => jsonResponse(200, { items: [] }),
      }),
      true,
    );
    expect(await screen.findByText("Votre première vente apparaîtra ici")).toBeInTheDocument();
  });

  it("propose de réessayer si le tableau de bord échoue", async () => {
    renderAt(
      "/app/dashboard",
      routeFetch({
        "/api/auth/me": () => jsonResponse(200, me),
        "/api/dashboard": () => jsonResponse(500, { error: "UNEXPECTED", message: "Lecture impossible" }),
      }),
      true,
    );
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    expect(screen.getByText("Lecture impossible")).toBeInTheDocument();
  });
});
