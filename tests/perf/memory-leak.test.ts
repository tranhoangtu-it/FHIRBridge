/**
 * Memory leak / RSS growth tests.
 * Verifies that repeated export initiations and TTL eviction
 * do not cause unbounded memory growth.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, userJwt, bearerHeader, MINIMAL_BUNDLE } from '../integration/helpers.js';

/** Minimal valid export body — uses fhir-endpoint connector with a blocked URL */
const EXPORT_BODY = {
  patientId: 'perf-patient',
  connectorConfig: {
    type: 'fhir-endpoint',
    // Use a valid public URL format (SSRF check passes, actual connection fails)
    baseUrl: 'https://hapi.fhir.org/baseR4',
    timeout: 100, // Very short — we don't need the export to succeed
  },
};

describe('Memory — export initiation RSS growth', () => {
  let server: FastifyInstance;
  let jwt: string;

  beforeAll(async () => {
    server = await createTestServer();
    jwt = userJwt();
  });

  afterAll(async () => {
    await server.close();
  });

  it('RSS delta < 50 MB after 100 export initiations', async () => {
    if (typeof global.gc === 'function') global.gc();
    const rssBefore = process.memoryUsage().rss;

    for (let i = 0; i < 100; i++) {
      await server.inject({
        method: 'POST',
        url: '/api/v1/export',
        headers: {
          authorization: bearerHeader(jwt),
          'content-type': 'application/json',
        },
        payload: JSON.stringify(EXPORT_BODY),
      });
    }

    // Allow async background exports to settle briefly
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (typeof global.gc === 'function') global.gc();
    const rssAfter = process.memoryUsage().rss;
    const deltaMB = (rssAfter - rssBefore) / 1024 / 1024;

    expect(deltaMB).toBeLessThan(50);
  });
});

describe('Memory — export store TTL eviction', () => {
  it('evictExpiredMemory removes stale records (unit-level check)', async () => {
    // Import ExportService directly to verify eviction logic
    // without needing to wait for real TTL (10 minutes)
    const { ExportService } = await import('../../packages/api/src/services/export-service.js');

    const service = new ExportService();
    // Access internal memStore via bracket notation (private field test)
    type StoreRecord = { createdAt: number; userId: string; status: string };
    const memStore = (service as unknown as { memStore: Map<string, StoreRecord> }).memStore;

    // Manually inject an expired record
    const fakeId = 'fake-expired-export';
    const staleCreatedAt = Date.now() - 11 * 60 * 1000; // 11 minutes ago (TTL = 10 min)
    memStore.set(fakeId, { status: 'complete', userId: 'user-x', createdAt: staleCreatedAt });

    expect(memStore.has(fakeId)).toBe(true);

    // Calling getStatus triggers evictExpiredMemory internally
    const record = await service.getStatus(fakeId, 'user-x');

    // After eviction the record is gone — getStatus returns undefined
    expect(record).toBeUndefined();
    expect(memStore.has(fakeId)).toBe(false);
  });
});

describe('Memory — bundle serialization no lingering allocations', () => {
  it('RSS stays stable across repeated serialization of 1K-resource bundles', async () => {
    const { generateBundle } = await import('./helpers/generate-csv.js');
    const { serializeToJson } = await import('../../packages/core/src/bundle/bundle-serializer.js');

    if (typeof global.gc === 'function') global.gc();
    const rssBefore = process.memoryUsage().rss;

    // Serialize and immediately discard — verifying GC can reclaim memory
    for (let i = 0; i < 50; i++) {
      const bundle = generateBundle(1_000);
      const _json = serializeToJson(bundle);
    }

    if (typeof global.gc === 'function') global.gc();
    const rssAfter = process.memoryUsage().rss;
    const deltaMB = (rssAfter - rssBefore) / 1024 / 1024;

    // Serializing and discarding 50 bundles should not balloon RSS
    expect(deltaMB).toBeLessThan(50);
  });
});
