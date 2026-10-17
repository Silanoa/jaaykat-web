const NBSP = "\u00A0";
const PHONE = /^(\+?221[7]\d{8}|[7]\d{8})$/;

export const CATEGORIES = [
  { value: "alimentation", label: "Alimentation" },
  { value: "beaute", label: "Beauté" },
  { value: "mode", label: "Mode" },
  { value: "telephonie", label: "Téléphonie" },
  { value: "restauration", label: "Restauration" },
  { value: "services", label: "Services" },
  { value: "autre", label: "Autre" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

const CATEGORY_VALUES = new Set<string>(CATEGORIES.map((category) => category.value));

export function normalizePhone(input: string): string | null {
  const stripped = input.replace(/[\s.\-]/g, "");
  if (!PHONE.test(stripped)) return null;
  if (stripped.startsWith("+")) return stripped;
  if (stripped.startsWith("221")) return `+${stripped}`;
  return `+221${stripped}`;
}

export function pinError(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "6 chiffres";
  if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321") {
    return "Ce code est trop simple.";
  }
  return null;
}

export function pinConfirmError(pin: string, confirm: string): string | null {
  const error = pinError(pin);
  if (error) return error;
  if (pin !== confirm) return "Les deux codes sont différents.";
  return null;
}

export type ShopDraft = {
  shopName: string;
  category: string;
  firstName: string;
  lastName: string;
  phone: string;
  acceptTerms: boolean;
};

export type ShopValue = {
  shopName: string;
  category: CategoryValue;
  firstName: string;
  lastName: string;
  phone: string;
};

export function validateShop(
  input: ShopDraft,
): { ok: true; value: ShopValue } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const shopName = input.shopName.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = normalizePhone(input.phone);
  if (shopName.length < 2 || shopName.length > 40) fields.shopName = "2 à 40 caractères";
  if (!CATEGORY_VALUES.has(input.category)) fields.category = "Choisissez une catégorie";
  if (firstName.length < 1 || firstName.length > 40) fields.firstName = "1 à 40 caractères";
  if (lastName.length < 1 || lastName.length > 40) fields.lastName = "1 à 40 caractères";
  if (!phone) fields.phone = "Numéro invalide";
  if (!input.acceptTerms) fields.acceptTerms = "Cochez la case pour continuer";
  if (Object.keys(fields).length > 0 || !phone) return { ok: false, fields };
  return {
    ok: true,
    value: {
      shopName,
      category: input.category as CategoryValue,
      firstName,
      lastName,
      phone,
    },
  };
}

export function payoutAmountError(amount: number, balance: number | null): string | null {
  if (!Number.isInteger(amount) || amount < 100 || amount > 200_000) {
    return `Entre 100 et 200${NBSP}000${NBSP}F`;
  }
  if (balance !== null && amount > balance) return "Solde insuffisant";
  return null;
}
