import { z, type ZodType } from "zod";
import {
  apiErrorSchema,
  attestationSchema,
  authSuccessSchema,
  balanceSchema,
  dashboardSchema,
  healthSchema,
  invoiceSchema,
  meSchema,
  payoutSchema,
  publicInvoiceSchema,
  quoteSchema,
  ratesSchema,
  salesSchema,
  scoreSchema,
  shareLinkSchema,
  shopSchema,
  systemSchema,
  type Attestation,
  type AuthSuccess,
  type Balance,
  type Dashboard,
  type Invoice,
  type Me,
  type Payout,
  type PayoutNetwork,
  type PayoutQuote,
  type PublicInvoice,
  type PublicShop,
  type Rates,
  type Sales,
  type Score,
  type SystemInfo,
} from "./schemas";
import { clearStoredSession, readStoredSession } from "./session";

const invoiceEnvelope = z.object({ invoice: invoiceSchema });
const quoteEnvelope = z.object({ quote: quoteSchema });
const payoutEnvelope = z.object({ payout: payoutSchema });

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly attemptsLeft?: number;
  readonly retryAfterSeconds?: number;
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: {
      attemptsLeft?: number;
      retryAfterSeconds?: number;
      fields?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.attemptsLeft = extra?.attemptsLeft;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
    this.fields = extra?.fields;
  }
}

type RequestOptions<T> = {
  method?: string;
  body?: unknown;
  schema?: ZodType<T>;
  idempotencyKey?: string;
  empty?: boolean;
};

export type ApiClient = ReturnType<typeof createApi>;

export function createApi(options: {
  storage: Storage;
  fetch?: typeof fetch;
  onUnauthenticated?: () => void;
}) {
  const fetchImpl = options.fetch ?? fetch;

  async function request<T>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    const token = readStoredSession(options.storage)?.token ?? null;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (opts.body !== undefined) headers.set("Content-Type", "application/json");
    if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);

    const response = await fetchImpl(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (response.status === 401 && token) {
      clearStoredSession(options.storage);
      options.onUnauthenticated?.();
    }

    if (opts.empty) {
      if (!response.ok) throw await errorFromResponse(response);
      return undefined as T;
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw errorFromBody(response.status, data);
    if (!opts.schema) return data as T;
    const parsed = opts.schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(response.status, "UNEXPECTED", "Réponse inattendue. Réessayez.");
    }
    return parsed.data;
  }

  return {
    register(body: {
      shopName: string;
      category: string;
      firstName: string;
      lastName: string;
      phone: string;
      pin: string;
    }): Promise<AuthSuccess> {
      return request("/api/auth/register", { body, schema: authSuccessSchema });
    },
    login(body: { phone: string; pin: string }): Promise<AuthSuccess> {
      return request("/api/auth/login", { body, schema: authSuccessSchema });
    },
    me(): Promise<Me> {
      return request("/api/auth/me", { schema: meSchema });
    },
    logout(): Promise<void> {
      return request("/api/auth/logout", { method: "POST", empty: true });
    },
    createInvoice(body: { amountXof: number; label?: string }, idempotencyKey: string): Promise<Invoice> {
      return request("/api/invoices", { body, idempotencyKey, schema: invoiceEnvelope }).then(
        (data) => data.invoice,
      );
    },
    getInvoice(id: string): Promise<Invoice> {
      return request(`/api/invoices/${encodeURIComponent(id)}`, { schema: invoiceEnvelope }).then(
        (data) => data.invoice,
      );
    },
    getShop(slug: string): Promise<PublicShop> {
      return request(`/api/public/shops/${encodeURIComponent(slug)}`, { schema: shopSchema });
    },
    createPublicInvoice(
      body: {
        slug: string;
        amountXof: number;
        payerName?: string;
        payerPhone?: string;
        deviceId?: string;
      },
      idempotencyKey: string,
    ): Promise<Invoice> {
      return request("/api/public/invoices", { body, idempotencyKey, schema: invoiceEnvelope }).then(
        (data) => data.invoice,
      );
    },
    getPublicInvoice(id: string): Promise<PublicInvoice> {
      return request(`/api/public/invoices/${encodeURIComponent(id)}`, { schema: publicInvoiceSchema });
    },
    payPublicInvoice(id: string, method: PayoutNetwork): Promise<PublicInvoice> {
      return request(`/api/public/invoices/${encodeURIComponent(id)}/pay`, {
        method: "POST",
        body: { method },
        schema: publicInvoiceSchema,
      });
    },
    sales(from: string, to: string): Promise<Sales> {
      const params = new URLSearchParams({ from, to });
      return request(`/api/sales?${params.toString()}`, { schema: salesSchema });
    },
    dashboard(range: "today" | "7d" | "30d"): Promise<Dashboard> {
      return request(`/api/dashboard?range=${range}`, { schema: dashboardSchema });
    },
    score(): Promise<Score> {
      return request("/api/score", { schema: scoreSchema });
    },
    shareScore(): Promise<{ url: string }> {
      return request("/api/score/share", { method: "POST", schema: shareLinkSchema });
    },
    balance(): Promise<Balance> {
      return request("/api/balance", { schema: balanceSchema });
    },
    quotePayout(body: {
      amountXof: number;
      network: PayoutNetwork;
      accountNumber: string;
      accountName: string;
    }): Promise<PayoutQuote> {
      return request("/api/payouts/quote", { body, schema: quoteEnvelope }).then((data) => data.quote);
    },
    createPayout(quoteId: string, idempotencyKey: string): Promise<Payout> {
      return request("/api/payouts", {
        body: { quoteId },
        idempotencyKey,
        schema: payoutEnvelope,
      }).then((data) => data.payout);
    },
    getPayout(id: string): Promise<Payout> {
      return request(`/api/payouts/${encodeURIComponent(id)}`, { schema: payoutEnvelope }).then(
        (data) => data.payout,
      );
    },
    rates(): Promise<Rates> {
      return request("/api/rates", { schema: ratesSchema });
    },
    system(): Promise<SystemInfo> {
      return request("/api/system", { schema: systemSchema });
    },
    health(): Promise<{ ok: boolean; bitnob?: boolean }> {
      return request("/api/health", { schema: healthSchema });
    },
    attestation(token: string): Promise<Attestation> {
      return request(`/api/public/shares/${encodeURIComponent(token)}`, { schema: attestationSchema });
    },
  };
}

function errorFromBody(status: number, data: unknown): ApiError {
  const parsed = apiErrorSchema.safeParse(data);
  if (!parsed.success) {
    return new ApiError(status, "UNEXPECTED", "La requête a échoué. Réessayez.");
  }
  return new ApiError(status, parsed.data.error, parsed.data.message ?? fallbackMessage(parsed.data.error), {
    attemptsLeft: parsed.data.attemptsLeft,
    retryAfterSeconds: parsed.data.retryAfterSeconds,
    fields: parsed.data.fields,
  });
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null);
  return errorFromBody(response.status, data);
}

function fallbackMessage(code: string): string {
  switch (code) {
    case "VALIDATION":
      return "Vérifiez les informations saisies.";
    case "PHONE_TAKEN":
      return "Ce numéro est déjà utilisé.";
    case "INVALID_CREDENTIALS":
      return "Code incorrect.";
    case "LOCKED":
      return "Trop d'essais. Réessayez plus tard.";
    case "RATE_LIMITED":
      return "Trop de requêtes. Patientez.";
    case "UNAUTHENTICATED":
      return "Votre session a expiré, reconnectez-vous.";
    case "BITNOB_UNAVAILABLE":
      return "La création a échoué, rien n'a été enregistré.";
    default:
      return "La requête a échoué. Réessayez.";
  }
}
