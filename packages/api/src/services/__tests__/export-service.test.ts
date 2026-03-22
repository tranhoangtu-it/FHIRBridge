/**
 * ExportService unit tests.
 * No real network calls — only tests the in-memory store and validation logic.
 */

import { describe, it, expect } from 'vitest';

import { ExportService } from '../export-service.js';

// Expose the private validateBaseUrl via re-exporting the module for testing
// We test it indirectly through startExport, and directly by extracting it.

describe('ExportService.startExport', () => {
  it('returns a UUID string', async () => {
    const svc = new ExportService();
    const id = await svc.startExport(
      {
        patientId: 'p1',
        connectorConfig: {
          type: 'fhir-endpoint',
          baseUrl: 'https://example.com/fhir',
          authType: 'none',
        },
        outputFormat: 'json',
      },
      'user-001',
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates a processing record immediately', async () => {
    const svc = new ExportService();
    const id = await svc.startExport(
      {
        patientId: 'p1',
        connectorConfig: {
          type: 'fhir-endpoint',
          baseUrl: 'https://example.com/fhir',
          authType: 'none',
        },
      },
      'user-002',
    );
    const record = svc.getStatus(id, 'user-002');
    // Record may be processing or already failed (no real endpoint) — should exist
    expect(record).toBeDefined();
    expect(['processing', 'failed', 'complete']).toContain(record!.status);
  });
});

describe('ExportService.getStatus', () => {
  it('returns undefined for non-existent exportId', () => {
    const svc = new ExportService();
    expect(svc.getStatus('nonexistent-id', 'user-001')).toBeUndefined();
  });

  it('returns undefined for wrong userId (IDOR protection)', async () => {
    const svc = new ExportService();
    const id = await svc.startExport(
      {
        patientId: 'p1',
        connectorConfig: {
          type: 'fhir-endpoint',
          baseUrl: 'https://example.com/fhir',
          authType: 'none',
        },
      },
      'owner-user',
    );

    // Attacker uses different userId
    const record = svc.getStatus(id, 'attacker-user');
    expect(record).toBeUndefined();
  });

  it('returns the record for the correct userId', async () => {
    const svc = new ExportService();
    const id = await svc.startExport(
      {
        patientId: 'p2',
        connectorConfig: {
          type: 'fhir-endpoint',
          baseUrl: 'https://example.com/fhir',
          authType: 'none',
        },
      },
      'correct-user',
    );

    const record = svc.getStatus(id, 'correct-user');
    expect(record).toBeDefined();
  });
});

describe('validateBaseUrl (SSRF protection — tested via runExport side-effects)', () => {
  /** Helper: start an export and wait briefly for the async pipeline to attempt connection */
  async function startAndWait(
    svc: ExportService,
    baseUrl: string,
    userId: string,
  ): Promise<string> {
    const id = await svc.startExport(
      {
        patientId: 'p1',
        connectorConfig: { type: 'fhir-endpoint', baseUrl, authType: 'none' },
      },
      userId,
    );
    // Give the async pipeline a tick to run and fail
    await new Promise<void>((r) => setTimeout(r, 50));
    return id;
  }

  it('blocks localhost', async () => {
    const svc = new ExportService();
    const id = await startAndWait(svc, 'http://localhost:8080/fhir', 'u1');
    const record = svc.getStatus(id, 'u1');
    expect(record?.status).toBe('failed');
    expect(record?.error).toMatch(/Internal endpoints are not allowed/i);
  });

  it('blocks 127.0.0.1', async () => {
    const svc = new ExportService();
    const id = await startAndWait(svc, 'http://127.0.0.1:8080/fhir', 'u2');
    const record = svc.getStatus(id, 'u2');
    expect(record?.status).toBe('failed');
    expect(record?.error).toMatch(/Internal endpoints are not allowed/i);
  });

  it('blocks private 192.168.x.x range', async () => {
    const svc = new ExportService();
    const id = await startAndWait(svc, 'http://192.168.1.1/fhir', 'u3');
    const record = svc.getStatus(id, 'u3');
    expect(record?.status).toBe('failed');
    expect(record?.error).toMatch(/Private IP ranges are not allowed/i);
  });

  it('blocks AWS metadata endpoint', async () => {
    const svc = new ExportService();
    const id = await startAndWait(svc, 'http://169.254.169.254/latest/meta-data', 'u4');
    const record = svc.getStatus(id, 'u4');
    expect(record?.status).toBe('failed');
    expect(record?.error).toMatch(/Internal endpoints are not allowed/i);
  });
});
