/**
 * PostgresAuditSink unit tests.
 * Uses mocked pg.Pool — no real Postgres connection required.
 * Tests batch collection, flush threshold, bounded queue, and AuditSink interface compliance.
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

/** MAX_PENDING_ENTRIES constant phải khớp với implementation */
const MAX_PENDING_ENTRIES = 10_000;

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

/** Helper để access private pending array qua type cast */
function getPending(sink: PostgresAuditSink): AuditLogEntry[] {
  return (sink as unknown as { pending: AuditLogEntry[] }).pending;
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
    expect(getPending(sink).length).toBe(5);
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

    expect(getPending(sink).length).toBe(0);
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

describe('PostgresAuditSink — bounded queue', () => {
  let sink: PostgresAuditSink;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    // Làm cho connect fail để flush không drain queue — giúp test overflow dễ hơn
    mockConnect.mockRejectedValue(new Error('Postgres down'));
    sink = new PostgresAuditSink('postgresql://localhost:5432/test');
  });

  afterEach(async () => {
    // Cho phép shutdown dù connect vẫn fail
    mockConnect.mockRejectedValue(new Error('Postgres down'));
    await sink.shutdown();
  });

  it('getDroppedEntryCount() trả về 0 khi queue chưa overflow', () => {
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    expect(sink.getDroppedEntryCount()).toBe(0);
    pushBounded(makeEntry());
    pushBounded(makeEntry());
    expect(sink.getDroppedEntryCount()).toBe(0);
  });

  it('getPendingCount() phản ánh đúng số entries trong queue', () => {
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    expect(sink.getPendingCount()).toBe(0);
    pushBounded(makeEntry());
    pushBounded(makeEntry());
    pushBounded(makeEntry());
    expect(sink.getPendingCount()).toBe(3);
  });

  it('queue bị cap ở MAX_PENDING_ENTRIES khi overflow MAX+500', () => {
    // Dùng pushBounded trực tiếp để tránh auto-flush re-queue storm
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    for (let i = 0; i < MAX_PENDING_ENTRIES + 500; i++) {
      pushBounded(makeEntry({ action: `action_${i}` }));
    }

    // Queue phải bị cap — không vượt quá MAX
    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES);
    // Phải có đúng 500 drops
    expect(sink.getDroppedEntryCount()).toBe(500);
  });

  it('queue empty → drop count = 0', () => {
    expect(sink.getPendingCount()).toBe(0);
    expect(sink.getDroppedEntryCount()).toBe(0);
  });

  it('overflow chính xác MAX+500 entries → pending === MAX, dropped >= 500', async () => {
    // Trực tiếp test pushBounded qua internal cast để kiểm soát flush
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    // Fill đến đúng MAX
    for (let i = 0; i < MAX_PENDING_ENTRIES; i++) {
      pushBounded(makeEntry({ action: `fill_${i}` }));
    }
    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES);
    expect(sink.getDroppedEntryCount()).toBe(0);

    // Push thêm 500 — mỗi push drop 1 oldest
    for (let i = 0; i < 500; i++) {
      pushBounded(makeEntry({ action: `overflow_${i}` }));
    }

    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES);
    expect(sink.getDroppedEntryCount()).toBe(500);
  });

  it('droppedEntryCount cumulative qua nhiều overflow rounds', () => {
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    // Round 1: fill đến MAX rồi overflow 100
    // Sau khi fill MAX_PENDING_ENTRIES, mỗi push thêm sẽ drop 1 oldest
    for (let i = 0; i < MAX_PENDING_ENTRIES + 100; i++) {
      pushBounded(makeEntry());
    }
    expect(sink.getDroppedEntryCount()).toBe(100);
    // Queue vẫn bị cap ở MAX (100 entries oldest đã bị drop)
    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES);

    // Simulate flush thành công bằng cách xả bớt 5000 entries
    getPending(sink).splice(0, 5_000);
    // pending còn lại: MAX - 5000 = 5000
    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES - 5_000);

    // Round 2: push đủ để fill lại và overflow thêm 200
    // Cần push (5000 + 200) để: fill lại 5000 chỗ trống, rồi overflow 200
    for (let i = 0; i < 5_000 + 200; i++) {
      pushBounded(makeEntry());
    }

    // Counter phải cộng dồn: 100 + 200 = 300
    expect(sink.getDroppedEntryCount()).toBe(300);
    expect(sink.getPendingCount()).toBe(MAX_PENDING_ENTRIES);
  });

  it('entry MỚI NHẤT được giữ lại khi overflow — oldest bị drop', async () => {
    const pushBounded = (
      sink as unknown as { pushBounded: (e: AuditLogEntry) => void }
    ).pushBounded.bind(sink);

    // Fill đến MAX với marker "old"
    for (let i = 0; i < MAX_PENDING_ENTRIES; i++) {
      pushBounded(makeEntry({ action: 'old' }));
    }

    // Push 1 entry mới
    pushBounded(makeEntry({ action: 'newest' }));

    const pending = getPending(sink);
    // Entry mới nhất phải ở cuối queue
    expect(pending[pending.length - 1]?.action).toBe('newest');
    // Entry đầu tiên phải là "old" (oldest của batch cũ, không phải entry đã bị drop)
    expect(pending[0]?.action).toBe('old');
    expect(sink.getDroppedEntryCount()).toBe(1);
  });
});
