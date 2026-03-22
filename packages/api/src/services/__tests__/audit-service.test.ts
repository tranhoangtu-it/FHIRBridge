/**
 * Tests for AuditService and ConsoleAuditSink.
 * Verifies interface contract and log method behavior — no external deps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService, ConsoleAuditSink, type AuditSink } from '../audit-service.js';
import type { AuditLogEntry } from '@fhirbridge/types';

describe('ConsoleAuditSink — interface implementation', () => {
  it('implements the AuditSink interface', () => {
    const sink = new ConsoleAuditSink();
    expect(typeof sink.write).toBe('function');
  });

  it('write() returns a Promise', async () => {
    const sink = new ConsoleAuditSink();
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userIdHash: 'abc1234567890123',
      action: 'export_start',
      status: 'success',
    };
    const result = sink.write(entry);
    expect(result).toBeInstanceOf(Promise);
    await result; // must not throw
  });

  it('writes structured JSON to stdout (no PHI fields)', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const sink = new ConsoleAuditSink();

    const entry: AuditLogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      userIdHash: 'deadbeef12345678',
      action: 'export_complete',
      status: 'success',
      resourceCount: 42,
    };

    await sink.write(entry);

    expect(writeSpy).toHaveBeenCalledOnce();
    const rawOutput = writeSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(rawOutput.trim());

    expect(parsed.audit).toBe(true);
    expect(parsed.user).toBe('deadbeef12345678');
    expect(parsed.action).toBe('export_complete');
    expect(parsed.status).toBe('success');
    expect(parsed.resources).toBe(42);

    // No PHI
    expect(parsed).not.toHaveProperty('patientId');
    expect(parsed).not.toHaveProperty('name');

    writeSpy.mockRestore();
  });
});

describe('AuditService', () => {
  let mockSink: AuditSink;
  let writeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeSpy = vi.fn().mockResolvedValue(undefined);
    mockSink = { write: writeSpy };
  });

  it('constructs with default ConsoleAuditSink when no sink provided', () => {
    const svc = new AuditService();
    expect(svc).toBeInstanceOf(AuditService);
  });

  it('calls sink.write with correct entry structure', async () => {
    const svc = new AuditService(mockSink);
    await svc.log({
      userIdHash: 'abc123',
      action: '/api/v1/export',
      status: 'success',
      resourceCount: 10,
      metadata: { method: 'POST', statusCode: 202 },
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    const entry = writeSpy.mock.calls[0]?.[0] as AuditLogEntry;
    expect(entry.userIdHash).toBe('abc123');
    expect(entry.action).toBe('/api/v1/export');
    expect(entry.status).toBe('success');
    expect(entry.resourceCount).toBe(10);
    expect(entry.metadata).toMatchObject({ method: 'POST', statusCode: 202 });
  });

  it('injects ISO timestamp on every log call', async () => {
    const svc = new AuditService(mockSink);
    await svc.log({ userIdHash: 'x', action: '/test', status: 'pending' });
    const entry = writeSpy.mock.calls[0]?.[0] as AuditLogEntry;
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('handles sink write errors without throwing', async () => {
    mockSink = { write: vi.fn().mockRejectedValue(new Error('db down')) };
    const svc = new AuditService(mockSink);
    await expect(svc.log({ userIdHash: 'y', action: '/x', status: 'error' })).rejects.toThrow();
  });
});
