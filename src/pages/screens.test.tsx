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
