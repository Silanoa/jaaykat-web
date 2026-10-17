import { formatClock } from "./format";

export type PostAction = "invoice" | "payout" | "login" | "register" | "public-invoice";

export function postBlockReason(action: PostAction, online: boolean): string | null {
  if (online) return null;
  switch (action) {
    case "invoice":
      return "Il faut du réseau pour encaisser.";
    case "payout":
      return "Il faut du réseau pour retirer.";
    case "login":
      return "Il faut du réseau pour se connecter.";
    case "register":
      return "Il faut du réseau pour créer la boutique.";
    case "public-invoice":
      return "Il faut du réseau pour payer.";
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

export function offlineBannerText(cachedAt: string | null): string {
  if (!cachedAt) return "Hors ligne : aucune donnée en cache.";
  return `Hors ligne : vos chiffres datent de ${formatClock(cachedAt)}`;
}

export function screenState(input: {
  online: boolean;
  loading: boolean;
  error: boolean;
  empty: boolean;
  hasData: boolean;
}): "loading" | "offline" | "error" | "empty" | "ready" {
  if (input.loading && !input.hasData) return "loading";
  if (!input.online && !input.hasData) return "offline";
  if (input.error && !input.hasData) return "error";
  if (input.empty) return "empty";
  return "ready";
}
