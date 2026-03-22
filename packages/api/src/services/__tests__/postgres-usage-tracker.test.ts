/**
 * Tests for PostgresUsageTracker — stubs pg.Pool to avoid real DB.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Stub pg.Pool before importing the module ─────────────────────────────────

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

const { PostgresUsageTracker } = await import('../postgres-usage-tracker.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('PostgresUsageTracker — construction', () => {
  it('constructs without throwing when db url provided', () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT 1 health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    expect(tracker).toBeInstanceOf(PostgresUsageTracker);
  });

  it('isHealthy() returns false initially (health check is async)', () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    // Health check runs async; not yet resolved
    expect(tracker.isHealthy()).toBe(false);
  });
});

describe('PostgresUsageTracker.trackExport', () => {
  it('calls pool.query with correct INSERT params', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // health check + insert
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT
    tracker.trackExport('hash-abc', 'fhir-json', 50, 1200, 'paid');

    // Give the async query a tick to run
    await new Promise((r) => setTimeout(r, 10));

    const insertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO usage_tracking'),
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

describe('PostgresUsageTracker.getUsage', () => {
  it('returns parsed stats when query succeeds', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({
      rows: [{ total_exports: '3', total_resources: '150', avg_duration: '800.5' }],
    });

    const stats = await tracker.getUsage('hash-abc', 'month');
    expect(stats.totalExports).toBe(3);
    expect(stats.totalResources).toBe(150);
    expect(stats.avgDurationMs).toBeCloseTo(800.5);
  });

  it('returns zero stats when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockResolvedValueOnce({ rows: [] });

    const stats = await tracker.getUsage('hash-xyz', 'day');
    expect(stats.totalExports).toBe(0);
    expect(stats.totalResources).toBe(0);
    expect(stats.avgDurationMs).toBeNull();
  });

  it('returns zero stats on query error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // health check
    const tracker = new PostgresUsageTracker('postgres://localhost/test');

    mockQuery.mockRejectedValueOnce(new Error('connection lost'));

    const stats = await tracker.getUsage('hash-fail', 'week');
    expect(stats.totalExports).toBe(0);
    expect(stats.totalResources).toBe(0);
  });
});

describe('PostgresUsageTracker.shutdown', () => {
  it('calls pool.end on shutdown', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const tracker = new PostgresUsageTracker('postgres://localhost/test');
    await tracker.shutdown();
    expect(mockEnd).toHaveBeenCalled();
  });
});
