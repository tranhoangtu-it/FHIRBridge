/**
 * Tests for usage-tracker: in-memory usage recording and period management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordExport,
  recordSummary,
  getUsage,
  resetPeriod,
  currentPeriod,
} from '../usage-tracker.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_USER = 'test-user-hash-abc123';

// Reset state between tests by clearing usage via resetPeriod
beforeEach(() => {
  resetPeriod(TEST_USER);
});

// ── Tests: recordExport ───────────────────────────────────────────────────────

describe('recordExport', () => {
  it('increments export count from zero', () => {
    recordExport(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.exportCount).toBe(1);
  });

  it('increments export count multiple times', () => {
    recordExport(TEST_USER);
    recordExport(TEST_USER);
    recordExport(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.exportCount).toBe(3);
  });

  it('does not affect aiSummaryCount', () => {
    recordExport(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.aiSummaryCount).toBe(0);
  });
});

// ── Tests: recordSummary ──────────────────────────────────────────────────────

describe('recordSummary', () => {
  it('increments aiSummaryCount from zero', () => {
    recordSummary(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.aiSummaryCount).toBe(1);
  });

  it('increments aiSummaryCount multiple times', () => {
    recordSummary(TEST_USER);
    recordSummary(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.aiSummaryCount).toBe(2);
  });

  it('does not affect exportCount', () => {
    recordSummary(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.exportCount).toBe(0);
  });
});

// ── Tests: getUsage ───────────────────────────────────────────────────────────

describe('getUsage', () => {
  it('returns zero counts for new user', () => {
    const usage = getUsage('brand-new-user-999');
    expect(usage.exportCount).toBe(0);
    expect(usage.aiSummaryCount).toBe(0);
    expect(usage.totalCostCents).toBe(0);
  });

  it('returns usage for current period by default', () => {
    recordExport(TEST_USER);
    const usage = getUsage(TEST_USER);
    expect(usage.period).toBe(currentPeriod());
  });

  it('returns usage for specified period', () => {
    const usage = getUsage(TEST_USER, '2025-01');
    expect(usage.period).toBe('2025-01');
    expect(usage.exportCount).toBe(0);
  });

  it('returns correct userId in record', () => {
    const usage = getUsage(TEST_USER);
    expect(usage.userId).toBe(TEST_USER);
  });
});

// ── Tests: period auto-calculation ───────────────────────────────────────────

describe('currentPeriod', () => {
  it('returns YYYY-MM format', () => {
    const period = currentPeriod();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns current year and month', () => {
    const period = currentPeriod();
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(period).toBe(expected);
  });
});

// ── Tests: resetPeriod ────────────────────────────────────────────────────────

describe('resetPeriod', () => {
  it('clears export count for current period', () => {
    recordExport(TEST_USER);
    recordExport(TEST_USER);
    expect(getUsage(TEST_USER).exportCount).toBe(2);

    resetPeriod(TEST_USER);
    expect(getUsage(TEST_USER).exportCount).toBe(0);
  });

  it('clears summary count for current period', () => {
    recordSummary(TEST_USER);
    expect(getUsage(TEST_USER).aiSummaryCount).toBe(1);

    resetPeriod(TEST_USER);
    expect(getUsage(TEST_USER).aiSummaryCount).toBe(0);
  });

  it('does not affect other users', () => {
    const otherUser = 'other-user-hash-xyz';
    recordExport(otherUser);
    recordExport(TEST_USER);

    resetPeriod(TEST_USER);

    expect(getUsage(TEST_USER).exportCount).toBe(0);
    expect(getUsage(otherUser).exportCount).toBe(1);

    // Cleanup
    resetPeriod(otherUser);
  });
});
