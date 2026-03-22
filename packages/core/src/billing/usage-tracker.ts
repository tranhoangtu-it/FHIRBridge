/**
 * In-memory usage tracker.
 * Tracks exports and AI summaries per user per billing period (YYYY-MM).
 * Interface is designed for easy swap to a Postgres-backed implementation later.
 */

import type { UsageRecord } from '@fhirbridge/types';

/** Return current billing period as YYYY-MM string */
function currentPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Composite key for the usage store */
function storeKey(userId: string, period: string): string {
  return `${userId}::${period}`;
}

/** In-memory store: key → UsageRecord */
const store = new Map<string, UsageRecord>();

/** Get or initialize a usage record for a user in the given period */
function getOrInit(userId: string, period: string): UsageRecord {
  const key = storeKey(userId, period);
  let record = store.get(key);
  if (!record) {
    record = { userId, period, exportCount: 0, aiSummaryCount: 0, totalCostCents: 0 };
    store.set(key, record);
  }
  return record;
}

/** Record one export for the user in the current billing period */
export function recordExport(userId: string): void {
  const period = currentPeriod();
  const record = getOrInit(userId, period);
  record.exportCount += 1;
}

/** Record one AI summary usage for the user in the current billing period */
export function recordSummary(userId: string): void {
  const period = currentPeriod();
  const record = getOrInit(userId, period);
  record.aiSummaryCount += 1;
}

/** Get usage for a user; defaults to current billing period if none specified */
export function getUsage(userId: string, period?: string): UsageRecord {
  const p = period ?? currentPeriod();
  return getOrInit(userId, p);
}

/** Reset usage for a user in the current billing period (e.g., after manual correction) */
export function resetPeriod(userId: string): void {
  const period = currentPeriod();
  const key = storeKey(userId, period);
  store.delete(key);
}

/** Expose period helper for testing */
export { currentPeriod };
