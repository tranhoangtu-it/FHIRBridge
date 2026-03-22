/**
 * Plan manager — defines billing plans and enforces quota logic.
 * Plans: free (5 exports/month, no AI) and paid ($5/month, 100 exports, AI summaries).
 */

import type { BillingTier, BillingPlan, UsageRecord } from '@fhirbridge/types';

/** Overage rate in cents per export beyond plan quota */
const OVERAGE_RATE_CENTS = 10;

/** Canonical plan definitions */
export const PLANS: Record<BillingTier, BillingPlan> = {
  free: {
    tier: 'free',
    maxExportsPerMonth: 5,
    includeAiSummary: false,
    pricePerMonth: 0,
  },
  paid: {
    tier: 'paid',
    maxExportsPerMonth: 100,
    includeAiSummary: true,
    pricePerMonth: 500, // $5.00 in cents
  },
};

/** Return the plan definition for a given tier */
export function getPlan(tier: BillingTier): BillingPlan {
  return PLANS[tier];
}

/** Check whether the user can perform another export given current usage */
export function canExport(
  usage: UsageRecord,
  plan: BillingPlan,
): { allowed: boolean; reason?: string } {
  if (usage.exportCount < plan.maxExportsPerMonth) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Export quota exceeded (${usage.exportCount}/${plan.maxExportsPerMonth} this month). Upgrade to paid tier for more exports.`,
  };
}

/** Check whether the user can use AI summary generation */
export function canUseSummary(
  usage: UsageRecord,
  plan: BillingPlan,
): { allowed: boolean; reason?: string } {
  if (!plan.includeAiSummary) {
    return {
      allowed: false,
      reason: 'AI summaries require a paid subscription ($5/month).',
    };
  }
  if (usage.aiSummaryCount >= plan.maxExportsPerMonth) {
    return {
      allowed: false,
      reason: `AI summary quota exceeded (${usage.aiSummaryCount}/${plan.maxExportsPerMonth} this month).`,
    };
  }
  return { allowed: true };
}

/**
 * Calculate overage cost in cents for exports beyond plan quota.
 * Returns 0 if within quota.
 */
export function calculateOverageCost(exportCount: number, plan: BillingPlan): number {
  const overage = exportCount - plan.maxExportsPerMonth;
  if (overage <= 0) return 0;
  return overage * OVERAGE_RATE_CENTS;
}
