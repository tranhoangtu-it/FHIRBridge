/**
 * Tests for BillingService — quota check and usage recording.
 * Uses actual @fhirbridge/core in-memory tracker (no external deps).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService } from '../billing-service.js';
import { resetPeriod } from '@fhirbridge/core';

const service = new BillingService();

// Use unique user IDs per test group to avoid cross-test pollution
const FREE_USER = `billing-test-free-${Date.now()}`;
const PAID_USER = `billing-test-paid-${Date.now()}`;

beforeEach(() => {
  resetPeriod(FREE_USER);
  resetPeriod(PAID_USER);
});

describe('BillingService.checkQuota — export', () => {
  it('allows export for free user with zero usage', () => {
    const result = service.checkQuota(FREE_USER, 'free', 'export');
    expect(result.allowed).toBe(true);
    expect(result.currentUsage).toBe(0);
    expect(result.limit).toBeGreaterThan(0);
  });

  it('allows export for paid user', () => {
    const result = service.checkQuota(PAID_USER, 'paid', 'export');
    expect(result.allowed).toBe(true);
  });

  it('denies export when free tier limit is exceeded', () => {
    // Exhaust free tier (5 exports)
    for (let i = 0; i < 5; i++) {
      service.recordUsage(FREE_USER, 'export');
    }
    const result = service.checkQuota(FREE_USER, 'free', 'export');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.currentUsage).toBe(5);
  });
});

describe('BillingService.checkQuota — summary', () => {
  it('denies AI summary for free user', () => {
    const result = service.checkQuota(FREE_USER, 'free', 'summary');
    expect(result.allowed).toBe(false);
  });

  it('allows AI summary for paid user', () => {
    const result = service.checkQuota(PAID_USER, 'paid', 'summary');
    expect(result.allowed).toBe(true);
  });
});

describe('BillingService.recordUsage', () => {
  it('increments export count', () => {
    service.recordUsage(FREE_USER, 'export');
    const usage = service.getUsageSummary(FREE_USER);
    expect(usage.exportCount).toBe(1);
  });

  it('increments aiSummaryCount for summary type', () => {
    service.recordUsage(PAID_USER, 'summary');
    const usage = service.getUsageSummary(PAID_USER);
    expect(usage.aiSummaryCount).toBe(1);
  });

  it('accumulates multiple calls', () => {
    service.recordUsage(FREE_USER, 'export');
    service.recordUsage(FREE_USER, 'export');
    service.recordUsage(FREE_USER, 'export');
    const usage = service.getUsageSummary(FREE_USER);
    expect(usage.exportCount).toBe(3);
  });
});

describe('BillingService.getUsageSummary', () => {
  it('returns zero counts for fresh user', () => {
    const freshUser = `fresh-billing-${Date.now()}`;
    const usage = service.getUsageSummary(freshUser);
    expect(usage.exportCount).toBe(0);
    expect(usage.aiSummaryCount).toBe(0);
    expect(usage.totalCostCents).toBe(0);
  });
});
