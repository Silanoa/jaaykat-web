import { describe, expect, it } from "vitest";
import { invoiceQrPayload, merchantWaitCopy, publicPayPhase } from "./pay-demo";

describe("paiement démo manuel", () => {
  it("encode payUrl dans le QR dès qu'il est présent", () => {
    expect(
      invoiceQrPayload({
        payUrl: "https://demo.example/p/awa-beaute?facture=inv1",
        bolt11: null,
      }),
    ).toBe("https://demo.example/p/awa-beaute?facture=inv1");
    expect(invoiceQrPayload({ payUrl: null, bolt11: "lntb1example" })).toBe("lntb1example");
    expect(invoiceQrPayload({ bolt11: "lntb1example" })).toBe("lntb1example");
  });

  it("attend le client sans promettre une confirmation automatique", () => {
    const copy = merchantWaitCopy({
      status: "pending",
      payUrl: "https://demo.example/p/awa-beaute?facture=inv1",
    });
    expect(copy.label).toBe("En attente du client");
    expect(copy.autoSettle).toBe(false);
  });

  it("garde le texte Lightning quand il n'y a pas de payUrl", () => {
    const copy = merchantWaitCopy({ status: "pending", payUrl: null });
    expect(copy.label).toBe("En attente du paiement");
    expect(copy.autoSettle).toBe(true);
  });

  it("propose le moyen de paiement seulement tant que personne n'a payé", () => {
    expect(
      publicPayPhase({ status: "pending", demoPayment: true, payMethod: null }),
    ).toBe("choose");
    expect(
      publicPayPhase({ status: "pending", demoPayment: true, payMethod: "wave" }),
    ).toBe("waiting");
    expect(
      publicPayPhase({ status: "pending", demoPayment: false, payMethod: null }),
    ).toBe("waiting");
    expect(publicPayPhase({ status: "paid", demoPayment: true, payMethod: "wave" })).toBe("paid");
    expect(publicPayPhase({ status: "expired", demoPayment: true, payMethod: null })).toBe("expired");
    expect(publicPayPhase({ status: "failed", demoPayment: true, payMethod: "orange" })).toBe("failed");
  });
});
