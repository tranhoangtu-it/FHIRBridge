/**
 * Tests for plan-manager: plan definitions, quota checks, overage costs.
 */

import { describe, it, expect } from 'vitest';
import { PLANS, getPlan, canExport, canUseSummary, calculateOverageCost } from '../plan-manager.js';
import type { UsageRecord } from '@fhirbridge/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUsage(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    userId: 'user-hash-001',
    period: '2026-03',
    exportCount: 0,
    aiSummaryCount: 0,
    totalCostCents: 0,
    ...overrides,
  };
}

// ── Tests: getPlan ────────────────────────────────────────────────────────────

describe('getPlan', () => {
  it('returns free plan with correct limits', () => {
    const plan = getPlan('free');
    expect(plan.tier).toBe('free');
    expect(plan.maxExportsPerMonth).toBe(5);
    expect(plan.includeAiSummary).toBe(false);
    expect(plan.pricePerMonth).toBe(0);
  });

  it('returns paid plan with correct limits', () => {
    const plan = getPlan('paid');
    expect(plan.tier).toBe('paid');
    expect(plan.maxExportsPerMonth).toBe(100);
    expect(plan.includeAiSummary).toBe(true);
    expect(plan.pricePerMonth).toBe(500); // $5.00 in cents
  });

  it('PLANS constant matches getPlan results', () => {
    expect(PLANS.free).toEqual(getPlan('free'));
    expect(PLANS.paid).toEqual(getPlan('paid'));
  });
});

// ── Tests: canExport ──────────────────────────────────────────────────────────

describe('canExport', () => {
  it('allows export when count is below limit (free tier)', () => {
    const usage = makeUsage({ exportCount: 3 });
    const plan = getPlan('free');
    const result = canExport(usage, plan);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows export at exactly limit - 1 (free tier)', () => {
    const usage = makeUsage({ exportCount: 4 });
    const plan = getPlan('free');
    expect(canExport(usage, plan).allowed).toBe(true);
  });

  it('denies export when count equals limit (free tier)', () => {
    const usage = makeUsage({ exportCount: 5 });
    const plan = getPlan('free');
    const result = canExport(usage, plan);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('5/5');
  });

  it('denies export when count exceeds limit', () => {
    const usage = makeUsage({ exportCount: 10 });
    const plan = getPlan('free');
    const result = canExport(usage, plan);
    expect(result.allowed).toBe(false);
  });

  it('allows export within paid tier quota', () => {
    const usage = makeUsage({ exportCount: 99 });
    const plan = getPlan('paid');
    expect(canExport(usage, plan).allowed).toBe(true);
  });

  it('denies export when paid tier quota exceeded', () => {
    const usage = makeUsage({ exportCount: 100 });
    const plan = getPlan('paid');
    expect(canExport(usage, plan).allowed).toBe(false);
  });
});

// ── Tests: canUseSummary ──────────────────────────────────────────────────────

describe('canUseSummary', () => {
  it('denies AI summary on free tier', () => {
    const usage = makeUsage({ aiSummaryCount: 0 });
    const plan = getPlan('free');
    const result = canUseSummary(usage, plan);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('paid');
  });

  it('allows AI summary on paid tier within quota', () => {
    const usage = makeUsage({ aiSummaryCount: 50 });
    const plan = getPlan('paid');
    expect(canUseSummary(usage, plan).allowed).toBe(true);
  });

  it('denies AI summary on paid tier when quota exceeded', () => {
    const usage = makeUsage({ aiSummaryCount: 100 });
    const plan = getPlan('paid');
    expect(canUseSummary(usage, plan).allowed).toBe(false);
  });
});

// ── Tests: calculateOverageCost ───────────────────────────────────────────────

describe('calculateOverageCost', () => {
  it('returns 0 when within quota', () => {
    const plan = getPlan('free');
    expect(calculateOverageCost(3, plan)).toBe(0);
    expect(calculateOverageCost(5, plan)).toBe(0);
  });

  it('calculates overage at $0.10 per extra export', () => {
    const plan = getPlan('free');
    expect(calculateOverageCost(6, plan)).toBe(10); // 1 overage × 10¢
    expect(calculateOverageCost(10, plan)).toBe(50); // 5 overage × 10¢
  });

  it('calculates overage on paid tier', () => {
    const plan = getPlan('paid');
    expect(calculateOverageCost(105, plan)).toBe(50); // 5 overage × 10¢
  });

  it('returns 0 when count equals limit exactly', () => {
    const plan = getPlan('paid');
    expect(calculateOverageCost(100, plan)).toBe(0);
  });
});
