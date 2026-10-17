import { describe, expect, it } from "vitest";
import { offlineBannerText, postBlockReason, screenState } from "./offline";
import { isCacheableApiRequest } from "./sw-policy";
import { invoiceStatusLabel, isPaid } from "./status";

describe("garde hors ligne", () => {
  it("désactive les POST avec une raison", () => {
    expect(postBlockReason("invoice", false)).toBe("Il faut du réseau pour encaisser.");
    expect(postBlockReason("payout", false)).toBe("Il faut du réseau pour retirer.");
    expect(postBlockReason("login", false)).toBe("Il faut du réseau pour se connecter.");
    expect(postBlockReason("register", false)).toBe("Il faut du réseau pour créer la boutique.");
    expect(postBlockReason("public-invoice", false)).toBe("Il faut du réseau pour payer.");
    expect(postBlockReason("invoice", true)).toBeNull();
  });

  it("affiche l'heure du cache", () => {
    expect(offlineBannerText(null)).toBe("Hors ligne : aucune donnée en cache.");
    expect(offlineBannerText("2026-10-17T18:42:00.000Z")).toBe(
      "Hors ligne : vos chiffres datent de 18:42",
    );
  });
});

describe("états d'écran", () => {
  it("distingue chargement, hors ligne, erreur, vide et prêt", () => {
    expect(screenState({ online: true, loading: true, error: false, empty: false, hasData: false })).toBe(
      "loading",
    );
    expect(screenState({ online: false, loading: false, error: true, empty: false, hasData: false })).toBe(
      "offline",
    );
    expect(screenState({ online: true, loading: false, error: true, empty: false, hasData: false })).toBe(
      "error",
    );
    expect(screenState({ online: true, loading: false, error: false, empty: true, hasData: false })).toBe(
      "empty",
    );
    expect(screenState({ online: false, loading: false, error: false, empty: false, hasData: true })).toBe(
      "ready",
    );
  });
});

describe("cache du service worker", () => {
  it("met en cache uniquement les GET dashboard, ventes et score", () => {
    expect(isCacheableApiRequest("GET", "/api/dashboard")).toBe(true);
    expect(isCacheableApiRequest("GET", "/api/sales")).toBe(true);
    expect(isCacheableApiRequest("GET", "/api/score")).toBe(true);
    expect(isCacheableApiRequest("POST", "/api/invoices")).toBe(false);
    expect(isCacheableApiRequest("POST", "/api/payouts")).toBe(false);
    expect(isCacheableApiRequest("GET", "/api/invoices/abc")).toBe(false);
    expect(isCacheableApiRequest("GET", "/api/payouts/abc")).toBe(false);
    expect(isCacheableApiRequest("POST", "/api/dashboard")).toBe(false);
  });
});

describe("statut de facture", () => {
  it("n'affiche Payé que pour le statut paid renvoyé par l'API", () => {
    expect(isPaid("paid")).toBe(true);
    expect(isPaid("pending")).toBe(false);
    expect(isPaid("PAID")).toBe(false);
    expect(isPaid("creating")).toBe(false);
    expect(invoiceStatusLabel("pending")).toBe("En attente du paiement");
    expect(invoiceStatusLabel("paid")).toBe("Payé");
    expect(invoiceStatusLabel("expired")).toBe("Facture expirée");
    expect(invoiceStatusLabel("failed")).toBe("Paiement non abouti");
    expect(invoiceStatusLabel("creating")).toBe("Création de la facture…");
  });
});
