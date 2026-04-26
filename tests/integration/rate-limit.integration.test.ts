/**
 * Integration tests — Rate limiting.
 * Single global budget configured via RATE_LIMIT_PER_MINUTE (test override = 10).
 * Uses in-memory rate limiter (no Redis in test config).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../packages/api/src/server.js';
import { makeJwt, bearerHeader, TEST_CONFIG, PROTECTED_PROBE_URL } from './helpers.js';

const PROBE_PAYLOAD = {
  type: 'fhir-endpoint',
  baseUrl: 'https://hapi.fhir.org/baseR4',
};

let server: FastifyInstance;
let originalBudget: string | undefined;

beforeAll(async () => {
  originalBudget = process.env['RATE_LIMIT_PER_MINUTE'];
  process.env['RATE_LIMIT_PER_MINUTE'] = '10';
  server = await createServer(TEST_CONFIG);
  await server.ready();
});

afterAll(async () => {
  await server.close();
  if (originalBudget === undefined) {
    delete process.env['RATE_LIMIT_PER_MINUTE'];
  } else {
    process.env['RATE_LIMIT_PER_MINUTE'] = originalBudget;
  }
});

async function floodRequests(
  srv: FastifyInstance,
  n: number,
  authHeader: string,
): Promise<Array<{ statusCode: number; headers: Record<string, string | string[] | undefined> }>> {
  const results = [];
  for (let i = 0; i < n; i++) {
    const res = await srv.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    results.push({
      statusCode: res.statusCode,
      headers: res.headers as Record<string, string | string[] | undefined>,
    });
  }
  return results;
}

describe('Rate limiting — single global budget (test override = 10/min)', () => {
  it('first 10 requests succeed (or non-429), 11th is 429', async () => {
    const uniqueId = `rate-test-${Date.now()}`;
    const token = makeJwt({ id: uniqueId });
    const header = bearerHeader(token);

    const responses = await floodRequests(server, 11, header);
    const first10 = responses.slice(0, 10);
    const eleventh = responses[10]!;

    for (const r of first10) {
      expect(r.statusCode).not.toBe(429);
    }
    expect(eleventh.statusCode).toBe(429);
  });

  it('429 response includes x-ratelimit-limit header', async () => {
    const uniqueId = `rate-header-${Date.now()}`;
    const token = makeJwt({ id: uniqueId });
    const header = bearerHeader(token);

    const responses = await floodRequests(server, 11, header);
    const limited = responses[10]!;

    expect(limited.statusCode).toBe(429);
    const limitHeader =
      limited.headers['x-ratelimit-limit'] ?? limited.headers['X-RateLimit-Limit'];
    expect(limitHeader).toBeDefined();
  });

  it('different users have independent counters', async () => {
    const userA = `rate-a-${Date.now()}`;
    const userB = `rate-b-${Date.now()}`;
    const tokenA = makeJwt({ id: userA });
    const tokenB = makeJwt({ id: userB });

    await floodRequests(server, 11, bearerHeader(tokenA));

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(tokenB), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).not.toBe(429);
  });

  it('health endpoint is exempt from rate limiting', async () => {
    const uniqueId = `rate-health-${Date.now()}`;
    const token = makeJwt({ id: uniqueId });

    await floodRequests(server, 11, bearerHeader(token));

    const healthRes = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthRes.statusCode).toBe(200);
  });
});
