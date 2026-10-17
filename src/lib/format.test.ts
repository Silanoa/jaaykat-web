import { describe, expect, it } from "vitest";
import { countdown, formatClock, formatSats, formatWhen, formatXof } from "./format";

describe("formatXof", () => {
  it("affiche les francs avec un espace insécable", () => {
    expect(formatXof(12500)).toBe("12\u00A0500\u00A0F");
    expect(formatXof(500)).toBe("500\u00A0F");
    expect(formatXof(0)).toBe("0\u00A0F");
    expect(formatXof(1500000)).toBe("1\u00A0500\u00A0000\u00A0F");
  });

  it("arrondit à l'entier le plus proche", () => {
    expect(formatXof(12.4)).toBe("12\u00A0F");
    expect(formatXof(12.5)).toBe("13\u00A0F");
  });
});

describe("formatSats", () => {
  it("affiche les sats fournis par l'API", () => {
    expect(formatSats(4230)).toBe("4\u00A0230 sats");
    expect(formatSats(0)).toBe("0 sats");
  });
});

describe("dates Dakar", () => {
  it("formate le jour et l'heure", () => {
    expect(formatWhen("2026-10-17T18:42:00.000Z")).toBe("sam. 17 oct., 18:42");
  });

  it("formate l'heure seule", () => {
    expect(formatClock("2026-10-17T18:42:00.000Z")).toBe("18:42");
  });
});

describe("countdown", () => {
  const now = Date.parse("2026-10-17T18:00:00.000Z");

  it("affiche le temps restant et l'heure d'expiration", () => {
    const value = countdown("2026-10-17T18:14:32.000Z", now);
    expect(value.mmss).toBe("14:32");
    expect(value.expired).toBe(false);
    expect(value.urgent).toBe(false);
    expect(value.expiresClock).toBe("18:14");
  });

  it("passe en urgence sous une minute", () => {
    const value = countdown("2026-10-17T18:00:45.000Z", now);
    expect(value.mmss).toBe("00:45");
    expect(value.urgent).toBe(true);
    expect(value.expired).toBe(false);
  });

  it("marque la facture expirée sans inventer un autre statut", () => {
    const value = countdown("2026-10-17T17:59:00.000Z", now);
    expect(value.expired).toBe(true);
    expect(value.mmss).toBe("00:00");
  });
});
