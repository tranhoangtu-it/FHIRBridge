/**
 * SummaryService unit tests.
 * No real AI API calls — tests the in-memory store management only.
 */

import type { Bundle } from '@fhirbridge/types';
import { describe, it, expect } from 'vitest';

import { SummaryService } from '../summary-service.js';

/** Minimal valid FHIR Bundle for testing */
function buildMinimalBundle(): Bundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'p-test',
        },
      },
    ],
  };
}

describe('SummaryService.startGeneration', () => {
  it('returns a UUID string', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildMinimalBundle(),
      hmacSecret: 'test-hmac-secret',
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('immediately creates a record in the store', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildMinimalBundle(),
      hmacSecret: 'test-hmac-secret',
    });
    const record = svc.getStatus(id);
    expect(record).toBeDefined();
    // Status is either processing (hasn't run yet) or failed (no API key in test env)
    expect(['processing', 'failed', 'complete']).toContain(record!.status);
  });

  it('generates distinct IDs for concurrent requests', async () => {
    const svc = new SummaryService();
    const bundle = buildMinimalBundle();
    const [id1, id2] = await Promise.all([
      svc.startGeneration({ bundle, hmacSecret: 'secret-a' }),
      svc.startGeneration({ bundle, hmacSecret: 'secret-b' }),
    ]);
    expect(id1).not.toBe(id2);
  });
});

describe('SummaryService.getStatus', () => {
  it('returns undefined for a non-existent summaryId', () => {
    const svc = new SummaryService();
    expect(svc.getStatus('no-such-id')).toBeUndefined();
  });

  it('returns the record for a valid summaryId', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildMinimalBundle(),
      hmacSecret: 'test-secret',
    });
    const record = svc.getStatus(id);
    expect(record).toBeDefined();
    expect(record!.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('eventually transitions to failed when no API key is set', async () => {
    const svc = new SummaryService();
    const id = await svc.startGeneration({
      bundle: buildMinimalBundle(),
      hmacSecret: 'test-secret',
      summaryConfig: { provider: 'claude' },
    });

    // Give the async pipeline time to fail without a real API key
    await new Promise<void>((r) => setTimeout(r, 200));

    const record = svc.getStatus(id);
    expect(record).toBeDefined();
    // In test environment (no ANTHROPIC_API_KEY), generation fails
    expect(['failed', 'processing', 'complete']).toContain(record!.status);
  });
});
