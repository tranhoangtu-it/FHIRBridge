/**
 * Usage tracker implementations for billing quota enforcement.
 *
 * - IUsageTracker: interface for swappable implementations
 * - InMemoryUsageTracker: default, class-based (no module-level state)
 *
 * Module-level functions (recordExport, recordSummary, getUsage, resetPeriod)
 * are preserved for backward-compat with existing callers and billing-service.ts.
 * They delegate to a shared singleton InMemoryUsageTracker instance.
 */

import type { UsageRecord } from '@fhirbridge/types';

// ── Interface ─────────────────────────────────────────────────────────────────

/** Shared contract for in-memory and Postgres-backed usage trackers */
export interface IUsageTracker {
  recordExport(userId: string): void | Promise<void>;
  recordSummary(userId: string): void | Promise<void>;
  getUsage(userId: string, period?: string): UsageRecord | Promise<UsageRecord>;
  resetPeriod(userId: string): void | Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return current billing period as YYYY-MM string */
export function currentPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Composite key for the usage store */
function storeKey(userId: string, period: string): string {
  return `${userId}::${period}`;
}

// ── InMemoryUsageTracker ──────────────────────────────────────────────────────

/**
 * Class-based in-memory usage tracker.
 * Injectable — no global state; each instance is isolated.
 */
export class InMemoryUsageTracker implements IUsageTracker {
  private readonly store = new Map<string, UsageRecord>();

  private getOrInit(userId: string, period: string): UsageRecord {
    const key = storeKey(userId, period);
    let record = this.store.get(key);
    if (!record) {
      record = { userId, period, exportCount: 0, aiSummaryCount: 0, totalCostCents: 0 };
      this.store.set(key, record);
    }
    return record;
  }

  recordExport(userId: string): void {
    const record = this.getOrInit(userId, currentPeriod());
    record.exportCount += 1;
  }

  recordSummary(userId: string): void {
    const record = this.getOrInit(userId, currentPeriod());
    record.aiSummaryCount += 1;
  }

  getUsage(userId: string, period?: string): UsageRecord {
    return this.getOrInit(userId, period ?? currentPeriod());
  }

  resetPeriod(userId: string): void {
    const key = storeKey(userId, currentPeriod());
    this.store.delete(key);
  }
}

// ── Backward-compat module-level functions ────────────────────────────────────
// These delegate to a shared singleton so all existing callers (billing-service,
// tests importing from @fhirbridge/core) continue to work without modification.

/** Shared singleton for module-level API callers */
const _singleton = new InMemoryUsageTracker();

/** Record one export for the user in the current billing period */
export function recordExport(userId: string): void {
  _singleton.recordExport(userId);
}

/** Record one AI summary usage for the user in the current billing period */
export function recordSummary(userId: string): void {
  _singleton.recordSummary(userId);
}

/** Get usage for a user; defaults to current billing period if none specified */
export function getUsage(userId: string, period?: string): UsageRecord {
  return _singleton.getUsage(userId, period);
}

/** Reset usage for a user in the current billing period */
export function resetPeriod(userId: string): void {
  _singleton.resetPeriod(userId);
}
