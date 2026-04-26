/**
 * Tests bảo mật C-2 (IDOR): SummaryService ownership enforcement.
 * Kiểm tra:
 * - getStatus() trả undefined khi userId không khớp
 * - getStatus() trả record khi userId khớp
 * - getStatus() không cần userId vẫn hoạt động (backward compat cho internal calls)
 * - SummaryRecord chứa đúng userId sau startGeneration
 */

import type { AuditLogEntry, Bundle } from '@fhirbridge/types';
import { describe, it, expect } from 'vitest';
import { SummaryService } from '../summary-service.js';
import { AuditService, type AuditSink } from '../audit-service.js';

function buildBundle(): Bundle {
  return { resourceType: 'Bundle', type: 'collection', entry: [] };
}

class CapturingAuditSink implements AuditSink {
  entries: AuditLogEntry[] = [];
  async write(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

describe('SummaryService IDOR — C-2 ownership enforcement', () => {
  it('stores userId on created record', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-001',
    });
    // Bypass ownership check bằng cách không truyền userId (internal)
    const record = await svc.getStatus(id);
    expect(record).toBeDefined();
    expect(record!.userId).toBe('owner-user-001');
  });

  it('returns record when userId matches owner', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-002',
    });
    const record = await svc.getStatus(id, 'owner-user-002');
    expect(record).toBeDefined();
    expect(record!.userId).toBe('owner-user-002');
  });

  it('returns undefined (not 403 leak) when userId does not match', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-003',
    });
    // Attacker với userId khác thử truy cập
    const record = await svc.getStatus(id, 'attacker-user-999');
    expect(record).toBeUndefined();
  });

  it('returns undefined for non-existent id regardless of userId', async () => {
    const svc = new SummaryService();
    const record = await svc.getStatus('non-existent-id', 'any-user');
    expect(record).toBeUndefined();
  });

  it('returns record when no userId passed (internal/admin use)', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-004',
    });
    // Không truyền userId — không có ownership check (dùng cho internal pipeline)
    const record = await svc.getStatus(id);
    expect(record).toBeDefined();
  });

  it('emits audit log entry on cross-tenant denial (AC-2)', async () => {
    const sink = new CapturingAuditSink();
    const audit = new AuditService(sink);
    const svc = new SummaryService(undefined, audit, 'test-salt-32-chars-min-required-here');

    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-005',
    });

    // Cross-tenant attempt
    const record = await svc.getStatus(id, 'attacker-user-007');
    expect(record).toBeUndefined();

    expect(sink.entries).toHaveLength(1);
    const entry = sink.entries[0]!;
    expect(entry.action).toBe('summary_access_denied');
    expect(entry.status).toBe('error');
    expect(entry.metadata?.['summary_id']).toBe(id);
    expect(entry.metadata?.['reason']).toBe('cross_tenant');
    // Audit nhận hashed user IDs (không raw)
    expect(entry.userIdHash).not.toBe('attacker-user-007');
    expect(entry.userIdHash).toMatch(/^[0-9a-f]{16}$/);
    expect(entry.metadata?.['owner_user_hash']).not.toBe('owner-user-005');
  });

  it('does NOT emit audit on legitimate access', async () => {
    const sink = new CapturingAuditSink();
    const audit = new AuditService(sink);
    const svc = new SummaryService(undefined, audit, 'test-salt-32-chars-min-required-here');

    const id = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'test-secret',
      userId: 'owner-user-006',
    });

    await svc.getStatus(id, 'owner-user-006');
    expect(sink.entries).toHaveLength(0);
  });

  it('does NOT emit audit when record does not exist', async () => {
    const sink = new CapturingAuditSink();
    const audit = new AuditService(sink);
    const svc = new SummaryService(undefined, audit, 'test-salt-32-chars-min-required-here');

    await svc.getStatus('non-existent-id', 'any-user');
    expect(sink.entries).toHaveLength(0);
  });

  it('two separate users cannot access each other records', async () => {
    const svc = new SummaryService();
    const idA = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'secret',
      userId: 'user-A',
    });
    const idB = await svc.startGeneration({
      bundle: buildBundle(),
      hmacSecret: 'secret',
      userId: 'user-B',
    });

    // user-A không thể xem record của user-B
    expect(await svc.getStatus(idB, 'user-A')).toBeUndefined();
    // user-B không thể xem record của user-A
    expect(await svc.getStatus(idA, 'user-B')).toBeUndefined();
    // Mỗi user xem record của mình OK
    expect(await svc.getStatus(idA, 'user-A')).toBeDefined();
    expect(await svc.getStatus(idB, 'user-B')).toBeDefined();
  });
});
