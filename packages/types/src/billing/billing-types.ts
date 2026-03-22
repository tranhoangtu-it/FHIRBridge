/**
 * Billing domain types for FHIRBridge.
 * Revenue model: Free (5 exports/month), Paid ($5/month → 100 exports + AI summaries).
 */

export type BillingTier = 'free' | 'paid';
export type PaymentProvider = 'stripe' | 'sepay';

/** Plan definition: limits and price */
export interface BillingPlan {
  tier: BillingTier;
  maxExportsPerMonth: number;
  includeAiSummary: boolean;
  /** Price in cents (USD) — 0 for free tier */
  pricePerMonth: number;
}

/** Per-user usage for a billing period (YYYY-MM) */
export interface UsageRecord {
  /** Hashed user identifier — no PHI stored */
  userId: string;
  /** Billing period in YYYY-MM format */
  period: string;
  exportCount: number;
  aiSummaryCount: number;
  /** Overage cost in cents */
  totalCostCents: number;
}

/** Payment intent created by a provider */
export interface PaymentIntent {
  id: string;
  provider: PaymentProvider;
  /** Amount in cents */
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  /** Provider-specific metadata (checkout URL, QR data, etc.) */
  metadata: Record<string, string>;
}

/** Billing configuration sourced from environment variables */
export interface BillingConfig {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  sepayApiKey?: string;
  defaultProvider: PaymentProvider;
}

/** Result of a quota check */
export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
}
