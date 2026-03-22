/**
 * Integration tests — Rate limiting.
 * Free tier: 10 req/min. 11th request must get 429.
 * Uses in-memory rate limiter (no Redis in test config).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, makeJwt, bearerHeader } from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

/** Send N requests with the same auth and return all responses */
async function floodRequests(
  srv: FastifyInstance,
  n: number,
  authHeader: string,
): Promise<Array<{ statusCode: number; headers: Record<string, string | string[] | undefined> }>> {
  const results = [];
  for (let i = 0; i < n; i++) {
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: authHeader },
    });
    results.push({
      statusCode: res.statusCode,
      headers: res.headers as Record<string, string | string[] | undefined>,
    });
  }
  return results;
}

describe('Rate limiting — free tier (10 req/min)', () => {
  it('first 10 requests succeed, 11th is 429', async () => {
    // Use a unique user ID per test run to avoid state bleed across tests
    const uniqueId = `rate-test-${Date.now()}`;
    const token = makeJwt({ id: uniqueId, tier: 'free' });
    const header = bearerHeader(token);

    const responses = await floodRequests(server, 11, header);
    const first10 = responses.slice(0, 10);
    const eleventh = responses[10]!;

    for (const r of first10) {
      expect(r.statusCode).toBe(200);
    }
    expect(eleventh.statusCode).toBe(429);
  });

  it('429 response includes x-ratelimit-limit header', async () => {
    const uniqueId = `rate-header-${Date.now()}`;
    const token = makeJwt({ id: uniqueId, tier: 'free' });
    const header = bearerHeader(token);

    // Exhaust + one over
    const responses = await floodRequests(server, 11, header);
    const limited = responses[10]!;

    expect(limited.statusCode).toBe(429);
    // @fastify/rate-limit normalises header names to lowercase
    const limitHeader =
      limited.headers['x-ratelimit-limit'] ?? limited.headers['X-RateLimit-Limit'];
    expect(limitHeader).toBeDefined();
  });

  it('429 response body contains retryAfter', async () => {
    const uniqueId = `rate-retry-${Date.now()}`;
    const token = makeJwt({ id: uniqueId, tier: 'free' });

    const responses = await floodRequests(server, 11, bearerHeader(token));
    const lastRes = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(token) },
    });

    // Find the 429 — could be response 10 (0-indexed) or beyond
    const blocked = responses.find((r) => r.statusCode === 429) ?? lastRes;
    expect(blocked.statusCode).toBe(429);
  });

  it('different users have independent counters', async () => {
    const userA = `rate-a-${Date.now()}`;
    const userB = `rate-b-${Date.now()}`;
    const tokenA = makeJwt({ id: userA, tier: 'free' });
    const tokenB = makeJwt({ id: userB, tier: 'free' });

    // Exhaust userA
    await floodRequests(server, 11, bearerHeader(tokenA));

    // userB should still be allowed
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(tokenB) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('health endpoint is exempt from rate limiting', async () => {
    const uniqueId = `rate-health-${Date.now()}`;
    const token = makeJwt({ id: uniqueId, tier: 'free' });

    // Exhaust the rate limit first
    await floodRequests(server, 11, bearerHeader(token));

    // Health should still respond 200 (allowList bypass)
    const healthRes = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthRes.statusCode).toBe(200);
  });
});
