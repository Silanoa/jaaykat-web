import { describe, expect, it, vi } from "vitest";
import { celebratePayment } from "./celebrate";

describe("paiement reçu", () => {
  it("joue un son et vibre une fois par facture", () => {
    const beep = vi.fn();
    const vibrate = vi.fn();
    const seen = new Set<string>();
    expect(celebratePayment("inv1", seen, { beep, vibrate })).toBe(true);
    expect(celebratePayment("inv1", seen, { beep, vibrate })).toBe(false);
    expect(beep).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith([80, 40, 80]);
  });
});
