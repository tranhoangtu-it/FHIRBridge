/**
 * BillingService — orchestrates plan checking and usage tracking for API routes.
 * Accepts an injectable IUsageTracker; defaults to the module-level singleton
 * (InMemoryUsageTracker) for backward compatibility with existing callers.
 */

import {
  getPlan,
  canExport,
  canUseSummary,
  recordExport as coreRecordExport,
  recordSummary as coreRecordSummary,
  getUsage as coreGetUsage,
} from '@fhirbridge/core';
import type { IUsageTracker } from '@fhirbridge/core';
import type { BillingTier, QuotaCheck, UsageRecord } from '@fhirbridge/types';

export class BillingService {
  /**
   * Injectable tracker. When omitted, falls back to the module-level
   * singleton from @fhirbridge/core (backward-compat with existing callers).
   */
  private readonly tracker: IUsageTracker | null;

  constructor(opts?: { usageTracker?: IUsageTracker }) {
    this.tracker = opts?.usageTracker ?? null;
  }

  /**
   * Check whether the user can perform an export or summary.
   * Returns quota check result including current usage stats.
   */
  checkQuota(userId: string, tier: BillingTier, type: 'export' | 'summary'): QuotaCheck {
    const plan = getPlan(tier);
    const usage = this.tracker
      ? (this.tracker.getUsage(userId) as UsageRecord)
      : coreGetUsage(userId);

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
    if (this.tracker) {
      if (type === 'export') {
        void this.tracker.recordExport(userId);
      } else {
        void this.tracker.recordSummary(userId);
      }
    } else {
      // Fall back to module-level singleton
      if (type === 'export') {
        coreRecordExport(userId);
      } else {
        coreRecordSummary(userId);
      }
    }
  }

  /** Return the current billing period usage summary for a user */
  getUsageSummary(userId: string): UsageRecord {
    return this.tracker ? (this.tracker.getUsage(userId) as UsageRecord) : coreGetUsage(userId);
  }
}
