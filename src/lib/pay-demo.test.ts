import { describe, expect, it } from "vitest";
import { invoiceQrPayload, lightningUri, merchantWaitCopy, payChoices, payProgress, publicPayPhase, updatedAgo } from "./pay-demo";

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

  it("liste le portefeuille Lightning puis les quatre moyens mobiles, avec des libellés neutres", () => {
    expect(payChoices().map((choice) => choice.method)).toEqual(["lightning", "wave", "orange", "free", "expresso"]);
    expect(payChoices().map((choice) => choice.label)).toEqual([
      "Portefeuille Lightning",
      "Wave",
      "Orange Money",
      "Free Money",
      "Expresso",
    ]);
    expect(payChoices()[0]?.hint).toBe("Application Lightning de l'acheteur");
    expect(payChoices()[1]?.hint).toBe("Mobile money");
  });

  it("construit le lien de portefeuille Lightning à partir de la facture", () => {
    expect(lightningUri("lntb1example")).toBe("lightning:lntb1example");
    expect(lightningUri("LIGHTNING:lntb1example")).toBe("lightning:lntb1example");
  });

  it("pilote le stepper par le statut renvoyé par l'API", () => {
    const states = (input: Parameters<typeof payProgress>[0]) => payProgress(input).map((step) => step.state);
    expect(payProgress({ status: "pending", payMethod: "wave" }).map((step) => step.label)).toEqual(["Envoi", "Confirmation", "Reçu"]);
    expect(states({ status: "pending", payMethod: null })).toEqual(["current", "todo", "todo"]);
    expect(states({ status: "pending", payMethod: "wave" })).toEqual(["done", "current", "todo"]);
    expect(states({ status: "paid", payMethod: "wave" })).toEqual(["done", "done", "done"]);
    expect(states({ status: "expired", payMethod: "wave" })).toEqual(["done", "failed", "todo"]);
    expect(states({ status: "failed", payMethod: null })).toEqual(["todo", "failed", "todo"]);
  });

  it("indique l'ancienneté des données sans exagérer la précision", () => {
    expect(updatedAgo(0)).toBe("mis à jour à l'instant");
    expect(updatedAgo(4_000)).toBe("mis à jour à l'instant");
    expect(updatedAgo(12_000)).toBe("mis à jour il y a 12 s");
    expect(updatedAgo(95_000)).toBe("mis à jour il y a 1 min");
    expect(updatedAgo(3_700_000)).toBe("mis à jour il y a plus d'une heure");
  });

});
