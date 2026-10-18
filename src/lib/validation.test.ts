import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  payoutAmountError,
  pinConfirmError,
  pinError,
  validateShop,
} from "./validation";

describe("normalizePhone", () => {
  it("accepte un mobile sénégalais et le normalise", () => {
    expect(normalizePhone("77 123 45 67")).toBe("+221771234567");
    expect(normalizePhone("77.123.45.67")).toBe("+221771234567");
    expect(normalizePhone("77-123-45-67")).toBe("+221771234567");
    expect(normalizePhone("+221 77 123 45 67")).toBe("+221771234567");
    expect(normalizePhone("221771234567")).toBe("+221771234567");
  });

  it("refuse un numéro qui ne commence pas par 7 ou trop court", () => {
    expect(normalizePhone("66 123 45 67")).toBeNull();
    expect(normalizePhone("77123456")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("pin", () => {
  it("accepte 6 chiffres non triviaux", () => {
    expect(pinError("482915")).toBeNull();
  });

  it("refuse un code incomplet, identique ou une suite", () => {
    expect(pinError("48291")).toBe("6 chiffres");
    expect(pinError("12a456")).toBe("6 chiffres");
    expect(pinError("111111")).toBe("Ce code est trop simple.");
    expect(pinError("000000")).toBe("Ce code est trop simple.");
    expect(pinError("123456")).toBe("Ce code est trop simple.");
    expect(pinError("654321")).toBe("Ce code est trop simple.");
  });

  it("signale une confirmation différente", () => {
    expect(pinConfirmError("482915", "482915")).toBeNull();
    expect(pinConfirmError("482915", "482916")).toBe("Les deux codes sont différents.");
    expect(pinConfirmError("111111", "111111")).toBe("Ce code est trop simple.");
  });
});

describe("validateShop", () => {
  const valid = {
    shopName: "Awa Beauté",
    category: "beaute",
    firstName: "Awa",
    lastName: "Diop",
    phone: "77 123 45 67",
    acceptTerms: true,
  };

  it("accepte une boutique complète", () => {
    const result = validateShop(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.phone).toBe("+221771234567");
  });

  it("signale chaque champ invalide", () => {
    const result = validateShop({
      shopName: "A",
      category: "inconnu",
      firstName: "",
      lastName: "x".repeat(41),
      phone: "123",
      acceptTerms: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.shopName).toBe("2 à 40 caractères");
      expect(result.fields.category).toBe("Choisissez une catégorie");
      expect(result.fields.firstName).toBe("1 à 40 caractères");
      expect(result.fields.lastName).toBe("1 à 40 caractères");
      expect(result.fields.phone).toBe("Numéro invalide");
      expect(result.fields.acceptTerms).toBe("Cochez la case pour continuer");
    }
  });
});

describe("payoutAmountError", () => {
  it("borne le montant entre 100 et 200 000 F", () => {
    expect(payoutAmountError(100, 5000)).toBeNull();
    expect(payoutAmountError(99, 5000)).toBe("Entre 100 et 200\u00A0000\u00A0F");
    expect(payoutAmountError(200001, 900000)).toBe("Entre 100 et 200\u00A0000\u00A0F");
  });

  it("compare au solde renvoyé par l'API", () => {
    expect(payoutAmountError(3000, 2500)).toBe("Solde retirable insuffisant : 2\u202f500\u00a0F");
    expect(payoutAmountError(3000, 0)).toBe("Solde retirable insuffisant : 0\u00a0F");
    expect(payoutAmountError(3000, null)).toBeNull();
  });
});
