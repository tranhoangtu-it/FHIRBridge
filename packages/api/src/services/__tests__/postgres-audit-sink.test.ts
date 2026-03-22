/**
 * PostgresAuditSink unit tests.
 * Uses mocked pg.Pool — no real Postgres connection required.
 * Tests batch collection, flush threshold, and AuditSink interface compliance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditLogEntry } from '@fhirbridge/types';

// Mock pg pool
const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
const mockPoolOn = vi.fn();

vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(() => ({
      query: mockQuery,
      connect: mockConnect,
      end: mockPoolEnd,
      on: mockPoolOn,
    })),
  };
});

import { PostgresAuditSink } from '../postgres-audit-sink.js';

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    userIdHash: 'abc123hash',
    action: 'export_start',
    status: 'success',
    resourceCount: 10,
    ...overrides,
  };
}

describe('PostgresAuditSink — AuditSink interface', () => {
  let sink: PostgresAuditSink;

  beforeEach(() => {
    vi.clearAllMocks();
    // Initial SELECT 1 health check
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    sink = new PostgresAuditSink('postgresql://localhost:5432/test');
  });

  afterEach(async () => {
    await sink.shutdown();
  });

  it('implements write() method (AuditSink interface)', () => {
    expect(typeof sink.write).toBe('function');
  });

  it('write() returns a Promise', () => {
    const result = sink.write(makeEntry());
    expect(result).toBeInstanceOf(Promise);
  });

  it('collects entries in pending batch without immediate flush', async () => {
    // Write fewer than FLUSH_BATCH_SIZE (50) entries
    for (let i = 0; i < 5; i++) {
      await sink.write(makeEntry({ action: `action_${i}` }));
    }
    // Batch not flushed yet (below threshold)
    const pending = (sink as unknown as { pending: AuditLogEntry[] }).pending;
    expect(pending.length).toBe(5);
  });

  it('triggers flush when batch reaches 50 entries', async () => {
    // Reset to ensure connect mock resolves for flush
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });

    // Write exactly 50 entries to trigger auto-flush
    const writes = Array.from({ length: 50 }, (_, i) =>
      sink.write(makeEntry({ action: `action_${i}` })),
    );
    await Promise.all(writes);

    // Allow microtasks to settle
    await new Promise<void>((r) => setTimeout(r, 10));

    // Flush should have been triggered — connect() called
    expect(mockConnect).toHaveBeenCalled();
  });

  it('flush() empties the pending array', async () => {
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });

    await sink.write(makeEntry());
    await sink.write(makeEntry());

    await sink.flush();

    const pending = (sink as unknown as { pending: AuditLogEntry[] }).pending;
    expect(pending.length).toBe(0);
  });

  it('flush() is a no-op when pending is empty', async () => {
    await sink.flush();
    // connect should NOT have been called (nothing to flush)
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('shutdown() calls flush then closes pool', async () => {
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    await sink.write(makeEntry());
    await sink.shutdown();
    expect(mockPoolEnd).toHaveBeenCalled();
  });
});

describe('PostgresAuditSink — error resilience', () => {
  it('continues accepting writes when connect fails', async () => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockConnect.mockRejectedValue(new Error('Connection refused'));

    const sink = new PostgresAuditSink('postgresql://localhost:5432/test');

    // write() should not throw even when flush fails
    await expect(sink.write(makeEntry())).resolves.toBeUndefined();

    await sink.shutdown();
  });
});
