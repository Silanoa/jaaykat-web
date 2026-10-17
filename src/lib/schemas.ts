import { z } from "zod";

export const invoiceStatusSchema = z.enum(["creating", "pending", "paid", "expired", "failed"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const networkSchema = z.enum(["wave", "orange", "free", "expresso"]);
export type PayoutNetwork = z.infer<typeof networkSchema>;

export const payoutStatusSchema = z.enum([
  "quoted",
  "initiated",
  "processing",
  "completed",
  "failed",
  "expired",
]);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  status: invoiceStatusSchema,
  amountXof: z.number(),
  amountSats: z.number(),
  bolt11: z.string().nullable(),
  expiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  label: z.string().nullable(),
  channel: z.enum(["dynamic", "static_qr"]),
  source: z.enum(["live", "seed"]),
  paymentHash: z.string().nullable().optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const userSchema = z.object({
  id: z.string(),
  phoneMasked: z.string(),
});
export type UserProfile = z.infer<typeof userSchema>;

export const merchantSchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  category: z.string(),
  qrUrl: z.string(),
});
export type MerchantProfile = z.infer<typeof merchantSchema>;

export const authSuccessSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
  merchant: merchantSchema,
});
export type AuthSuccess = z.infer<typeof authSuccessSchema>;

export const meSchema = z.object({
  user: userSchema,
  merchant: merchantSchema,
  session: z.object({ expiresAt: z.string() }),
});
export type Me = z.infer<typeof meSchema>;

export const publicInvoiceSchema = z.object({
  status: invoiceStatusSchema,
  amountXof: z.number(),
  expiresAt: z.string().nullable(),
});
export type PublicInvoice = z.infer<typeof publicInvoiceSchema>;

export const shopSchema = z.object({
  name: z.string(),
  category: z.string(),
});
export type PublicShop = z.infer<typeof shopSchema>;

export const saleItemSchema = z.object({
  id: z.string(),
  status: invoiceStatusSchema,
  amountXof: z.number(),
  amountSats: z.number().nullable().optional(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
  label: z.string().nullable().optional(),
  channel: z.enum(["dynamic", "static_qr"]),
  source: z.enum(["live", "seed"]),
  payerNickname: z.string().nullable().optional(),
});
export type SaleItem = z.infer<typeof saleItemSchema>;

export const salesSchema = z.object({
  items: z.array(saleItemSchema),
});
export type Sales = z.infer<typeof salesSchema>;

export const dashboardSchema = z.object({
  kpis: z.object({
    revenueXof: z.number(),
    revenueDeltaPct: z.number().nullable(),
    salesCount: z.number(),
    averageBasketXof: z.number().nullable(),
    conversionRate: z.number().nullable(),
    medianPaySeconds: z.number().nullable(),
    bestDay: z.string().nullable(),
    peakLabel: z.string().nullable(),
  }),
  heatmap: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      hour: z.number().int().min(0).max(23),
      salesCount: z.number(),
      revenueXof: z.number(),
    }),
  ),
  loyal: z.array(
    z.object({
      nickname: z.string(),
      purchases: z.number(),
      revenueXof: z.number(),
    }),
  ),
  advice: z
    .object({
      text: z.string(),
      figures: z.string().nullable(),
    })
    .nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const scoreSchema = z.object({
  score: z.number().nullable(),
  band: z.enum(["A", "B", "C", "D"]).nullable(),
  eligible: z.boolean(),
  computedAt: z.string().nullable(),
  components: z.array(
    z.object({
      key: z.enum(["regularity", "growth", "volume", "loyalty", "quality"]),
      value: z.number(),
    }),
  ),
  actions: z.array(z.object({ text: z.string(), points: z.number() })),
  progress: z
    .object({
      daysSinceFirst: z.number(),
      salesCount: z.number(),
    })
    .nullable(),
});
export type Score = z.infer<typeof scoreSchema>;

export const quoteSchema = z.object({
  id: z.string(),
  amountXof: z.number(),
  receivedXof: z.number(),
  exchangeRate: z.string(),
  fees: z.string(),
  network: networkSchema,
  accountNumberMasked: z.string(),
  accountName: z.string(),
  expiresAt: z.string(),
});
export type PayoutQuote = z.infer<typeof quoteSchema>;

export const payoutSchema = z.object({
  id: z.string(),
  status: payoutStatusSchema,
  amountXof: z.number(),
  network: networkSchema,
  reference: z.string(),
  failureReason: z.string().nullable().optional(),
});
export type Payout = z.infer<typeof payoutSchema>;

export const balanceSchema = z.object({
  balanceXof: z.number(),
  balanceSats: z.number(),
  lastPayouts: z.array(
    z.object({
      id: z.string(),
      amountXof: z.number(),
      network: networkSchema,
      status: payoutStatusSchema,
      createdAt: z.string(),
    }),
  ),
});
export type Balance = z.infer<typeof balanceSchema>;

export const ratesSchema = z.object({
  btcXof: z.number(),
  btcUsd: z.number(),
  usdXof: z.number(),
  ts: z.string(),
  validFor: z.number(),
  source: z.string(),
});
export type Rates = z.infer<typeof ratesSchema>;

export const systemSchema = z.object({
  env: z.string(),
  platformBalances: z.unknown(),
  lastCalls: z.array(
    z.object({
      at: z.string(),
      method: z.string(),
      path: z.string(),
      status: z.number().nullable(),
      durationMs: z.number().nullable(),
      correlationId: z.string().nullable(),
    }),
  ),
  seedHistory: z.boolean().optional(),
});
export type SystemInfo = z.infer<typeof systemSchema>;

export const shareLinkSchema = z.object({ url: z.string() });

export const attestationSchema = z.object({
  shopName: z.string(),
  score: z.number().nullable(),
  band: z.enum(["A", "B", "C", "D"]).nullable(),
  period: z.string(),
  salesCount: z.number(),
  computedAt: z.string(),
  expiresAt: z.string(),
  status: z.enum(["valid", "expired", "revoked"]),
});
export type Attestation = z.infer<typeof attestationSchema>;

export const healthSchema = z.object({
  ok: z.boolean(),
  bitnob: z.boolean().optional(),
});

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  attemptsLeft: z.number().optional(),
  retryAfterSeconds: z.number().optional(),
  fields: z.record(z.string()).optional(),
});
