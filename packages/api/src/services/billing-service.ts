/**
 * BillingService — orchestrates plan checking and usage tracking for API routes.
 * Wraps core billing functions into a stateful service class.
 */

import {
  getPlan,
  canExport,
  canUseSummary,
  recordExport,
  recordSummary,
  getUsage,
} from '@fhirbridge/core';
import type { BillingTier, QuotaCheck, UsageRecord } from '@fhirbridge/types';

export class BillingService {
  /**
   * Check whether the user can perform an export or summary.
   * Returns quota check result including current usage stats.
   */
  checkQuota(userId: string, tier: BillingTier, type: 'export' | 'summary'): QuotaCheck {
    const plan = getPlan(tier);
    const usage = getUsage(userId);

    if (type === 'export') {
      const result = canExport(usage, plan);
      return {
        allowed: result.allowed,
        reason: result.reason,
        currentUsage: usage.exportCount,
        limit: plan.maxExportsPerMonth,
      };
    }

    const result = canUseSummary(usage, plan);
    return {
      allowed: result.allowed,
      reason: result.reason,
      currentUsage: usage.aiSummaryCount,
      limit: plan.includeAiSummary ? plan.maxExportsPerMonth : 0,
    };
  }

  /** Record an export or summary usage event for the user */
  recordUsage(userId: string, type: 'export' | 'summary'): void {
    if (type === 'export') {
      recordExport(userId);
    } else {
      recordSummary(userId);
    }
  }

  /** Return the current billing period usage summary for a user */
  getUsageSummary(userId: string): UsageRecord {
    return getUsage(userId);
  }
}
