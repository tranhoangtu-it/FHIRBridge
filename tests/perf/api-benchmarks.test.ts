/**
 * API response time and throughput benchmarks.
 * Uses server.inject() — no real HTTP overhead.
 * Thresholds are intentionally loose for CI environments.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, freeUserJwt, bearerHeader } from '../integration/helpers.js';

describe('API benchmarks', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  // Collect N timings via inject and return sorted array
  async function timings(count: number, url: string, headers?: Record<string, string>) {
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      await server.inject({ method: 'GET', url, headers });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return times;
  }

  it('GET /health p95 < 50ms', async () => {
    const t = await timings(100, '/api/v1/health');
    const p95 = t[Math.floor(t.length * 0.95)]!;
    expect(p95).toBeLessThan(50);
  });

  it('GET /billing/plans p95 < 50ms', async () => {
    const jwt = freeUserJwt();
    const t = await timings(100, '/api/v1/billing/plans', {
      authorization: bearerHeader(jwt),
    });
    const p95 = t[Math.floor(t.length * 0.95)]!;
    expect(p95).toBeLessThan(50);
  });

  it('handles 100 sequential requests at >= 100 req/s', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await server.inject({ method: 'GET', url: '/api/v1/health' });
    }
    const elapsed = performance.now() - start;
    const rps = 100 / (elapsed / 1000);
    expect(rps).toBeGreaterThan(100);
  });

  it('RSS delta < 200 MB after 1000 requests', async () => {
    // Force GC if available (Node --expose-gc)
    if (typeof global.gc === 'function') global.gc();
    const rssBefore = process.memoryUsage().rss;

    for (let i = 0; i < 1000; i++) {
      await server.inject({ method: 'GET', url: '/api/v1/health' });
    }

    if (typeof global.gc === 'function') global.gc();
    const rssAfter = process.memoryUsage().rss;
    const deltaMB = (rssAfter - rssBefore) / 1024 / 1024;
    expect(deltaMB).toBeLessThan(200);
  });
});
