/**
 * Tests for PostgresUsageTracker — stubs pg.Pool để tránh real DB.
 *
 * Covers:
 *  - IUsageTracker interface: recordExport, recordSummary, getUsage, resetPeriod
 *  - Legacy methods: trackExport, getUsageStats, shutdown
 *  - Error paths: connection lost → degrade gracefully (zero stats, no throw)
 *  - Multi-user isolation
 *  - Period boundary: record in April → May getUsage returns 0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as CoreModule from '@fhirbridge/core';

// ── Stub pg.Pool trước khi import module ─────────────────────────────────────

const mockQuery = vi.fn();
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
    on: mockOn,
  })),
}));

// Stub currentPeriod để pin về tháng cụ thể trong các test period boundary
const mockCurrentPeriod = vi.fn().mockReturnValue('2025-04');

vi.mock('@fhirbridge/core', async (importOriginal) => {
  const original = await importOriginal<typeof CoreModule>();
  return {
    ...original,
    currentPeriod: () => mockCurrentPeriod(),
  };
});

const { PostgresUsageTracker } = await import('../postgres-usage-tracker.js');

afterEach(() => {
  vi.clearAllMocks();
  mockCurrentPeriod.mockReturnValue('2025-04');
});

// ── Construction ─────────────────────────────────────────────────────────────

describe('PostgresUsageTracker — construction', () => {
  it('constructs without throwing when db url provided', () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT 1 health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    expect(tracker).toBeInstanceOf(PostgresUsageTracker);
  });

  it('isHealthy() returns false initially (health check is async)', () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    // Health check runs async; chưa resolved
    expect(tracker.isHealthy()).toBe(false);
  });
});

// ── IUsageTracker: recordExport ───────────────────────────────────────────────

describe('PostgresUsageTracker.recordExport (IUsageTracker)', () => {
  it('inserts into usage_tracking with export event type', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    await tracker.recordExport('hash-user-1');

    const insertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO usage_tracking'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params[0]).toBe('hash-user-1');
    // export_type = 'export' (not 'ai-summary')
    expect(params[1]).toBe('export');
  });

  it('does not throw when pool.query rejects', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    await expect(tracker.recordExport('hash-fail')).resolves.toBeUndefined();
  });
});

// ── IUsageTracker: recordSummary ──────────────────────────────────────────────

describe('PostgresUsageTracker.recordSummary (IUsageTracker)', () => {
  it('inserts into usage_tracking with ai-summary sentinel type', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    await tracker.recordSummary('hash-user-2');

    const insertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO usage_tracking'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params[0]).toBe('hash-user-2');
    // AI summary sentinel
    expect(params[1]).toBe('ai-summary');
  });

  it('does not throw when pool.query rejects', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('db gone'));
    await expect(tracker.recordSummary('hash-fail')).resolves.toBeUndefined();
  });
});

// ── IUsageTracker: getUsage ───────────────────────────────────────────────────

describe('PostgresUsageTracker.getUsage (IUsageTracker)', () => {
  it('returns UsageRecord with correct counts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({
      rows: [{ export_count: '3', summary_count: '1' }],
    });

    const record = await tracker.getUsage('hash-abc', '2025-04');
    expect(record.userId).toBe('hash-abc');
    expect(record.period).toBe('2025-04');
    expect(record.exportCount).toBe(3);
    expect(record.aiSummaryCount).toBe(1);
    expect(record.totalCostCents).toBe(0); // BillingService tính, không phải tracker
  });

  it('defaults to currentPeriod() when period omitted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({
      rows: [{ export_count: '2', summary_count: '0' }],
    });

    const record = await tracker.getUsage('hash-abc');
    // currentPeriod() được stub về '2025-04'
    expect(record.period).toBe('2025-04');
  });

  it('returns zero UsageRecord when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({ rows: [] });

    const record = await tracker.getUsage('hash-xyz', '2025-04');
    expect(record.exportCount).toBe(0);
    expect(record.aiSummaryCount).toBe(0);
  });

  it('returns zero UsageRecord on query error (graceful degradation)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('connection lost'));

    const record = await tracker.getUsage('hash-fail', '2025-04');
    expect(record.exportCount).toBe(0);
    expect(record.aiSummaryCount).toBe(0);
    expect(record.userId).toBe('hash-fail');
  });

  it('period boundary: record in April, getUsage for May returns 0 (different period start)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    // getUsage cho tháng 2025-05 → period start = 2025-05-01
    // DB trả về 0 (không có records trong tháng 5)
    mockQuery.mockResolvedValueOnce({
      rows: [{ export_count: '0', summary_count: '0' }],
    });

    const record = await tracker.getUsage('hash-april-user', '2025-05');
    expect(record.exportCount).toBe(0);
    expect(record.aiSummaryCount).toBe(0);
    expect(record.period).toBe('2025-05');

    // Verify query được gọi với period start của tháng 5 (2025-05-01T00:00:00Z)
    // Tìm call có $2 param là Date (getUsage query), bỏ qua health check SELECT 1
    const queryCall = mockQuery.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        (c[0] as string).includes('SELECT') &&
        Array.isArray(c[1]) &&
        c[1][1] instanceof Date,
    );
    const params = queryCall?.[1] as unknown[];
    const periodStartArg = params?.[1] as Date;
    expect(periodStartArg).toBeInstanceOf(Date);
    expect(periodStartArg.getUTCFullYear()).toBe(2025);
    expect(periodStartArg.getUTCMonth()).toBe(4); // 0-indexed: 4 = May
    expect(periodStartArg.getUTCDate()).toBe(1);
  });

  it('multi-user isolation: different userIds query with their own hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    // User 1
    mockQuery.mockResolvedValueOnce({
      rows: [{ export_count: '5', summary_count: '2' }],
    });
    const r1 = await tracker.getUsage('hash-user-1', '2025-04');

    // User 2
    mockQuery.mockResolvedValueOnce({
      rows: [{ export_count: '1', summary_count: '0' }],
    });
    const r2 = await tracker.getUsage('hash-user-2', '2025-04');

    expect(r1.userId).toBe('hash-user-1');
    expect(r1.exportCount).toBe(5);
    expect(r2.userId).toBe('hash-user-2');
    expect(r2.exportCount).toBe(1);
  });
});

// ── IUsageTracker: resetPeriod ────────────────────────────────────────────────

describe('PostgresUsageTracker.resetPeriod (IUsageTracker)', () => {
  it('executes DELETE for the current period', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    await tracker.resetPeriod('hash-user-reset');

    const deleteCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('DELETE FROM usage_tracking'),
    );
    expect(deleteCall).toBeDefined();
    const params = deleteCall?.[1] as unknown[];
    expect(params[0]).toBe('hash-user-reset');
  });

  it('does not throw on query error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('db error'));
    await expect(tracker.resetPeriod('hash-fail')).resolves.toBeUndefined();
  });
});

// ── Legacy: trackExport ───────────────────────────────────────────────────────

describe('PostgresUsageTracker.trackExport (legacy)', () => {
  it('calls pool.query with correct INSERT params', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // health check + insert
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT
    tracker.trackExport('hash-abc', 'fhir-json', 50, 1200, 'paid');

    // Give the async query a tick to run
    await new Promise((r) => setTimeout(r, 10));

    const insertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO usage_tracking'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params).toEqual(['hash-abc', 'fhir-json', 50, 1200, 'paid']);
  });

  it('does not throw when pool.query rejects', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('db error'));
    expect(() => tracker.trackExport('hash-xyz', 'csv', 10, 500, 'free')).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});

// ── Legacy: getUsageStats ────────────────────────────────────────────────────

describe('PostgresUsageTracker.getUsageStats (legacy)', () => {
  it('returns parsed stats when query succeeds', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({
      rows: [{ total_exports: '3', total_resources: '150', avg_duration: '800.5' }],
    });

    const stats = await tracker.getUsageStats('hash-abc', 'month');
    expect(stats.totalExports).toBe(3);
    expect(stats.totalResources).toBe(150);
    expect(stats.avgDurationMs).toBeCloseTo(800.5);
  });

  it('returns zero stats when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({ rows: [] });

    const stats = await tracker.getUsageStats('hash-xyz', 'day');
    expect(stats.totalExports).toBe(0);
    expect(stats.totalResources).toBe(0);
    expect(stats.avgDurationMs).toBeNull();
  });

  it('returns zero stats on query error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('connection lost'));

    const stats = await tracker.getUsageStats('hash-fail', 'week');
    expect(stats.totalExports).toBe(0);
    expect(stats.totalResources).toBe(0);
  });
});

// ── Shutdown ─────────────────────────────────────────────────────────────────

describe('PostgresUsageTracker.shutdown', () => {
  it('calls pool.end on shutdown', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    await tracker.shutdown();
    expect(mockEnd).toHaveBeenCalled();
  });
});
