/**
 * Rate limiter stress tests.
 * Uses isolated Fastify instances (not the full server) to control
 * the authUser directly without going through JWT auth flow.
 *
 * Test cap: 10 req/min via maxPerMinute option. Sequential calls are deterministic.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from '../../packages/api/src/plugins/rate-limiter-plugin.js';
import type { AuthUser } from '../../packages/api/src/plugins/auth-plugin.js';

const TEST_BUDGET = 10;

async function buildRateLimitApp(user: AuthUser): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorateRequest('authUser', null);
  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser }).authUser = user;
  });

  await app.register(rateLimiterPlugin, { maxPerMinute: TEST_BUDGET });
  app.get('/api/v1/data', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('Rate limiter — sequential stress (cap 10/min)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildRateLimitApp({ id: 'stress-user-seq' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('first 10 sequential requests succeed, then 429 begins', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 15; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
      statuses.push(res.statusCode);
    }

    const successes = statuses.filter((s) => s === 200).length;
    const tooMany = statuses.filter((s) => s === 429).length;

    expect(successes).toBe(TEST_BUDGET);
    expect(tooMany).toBe(15 - TEST_BUDGET);
  });

  it('response body for 429 includes retryAfter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.statusCode).toBe(429);
    const body = res.json<{ retryAfter: number }>();
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

describe('Rate limiter — independent counters per user', () => {
  it('each user (separate apps) has an independent window — both get 10/10 OK', async () => {
    const appAlpha = await buildRateLimitApp({ id: 'user-alpha-iv' });
    const appBeta = await buildRateLimitApp({ id: 'user-beta-iv' });

    try {
      const alphaStatuses: number[] = [];
      const betaStatuses: number[] = [];

      for (let i = 0; i < 10; i++) {
        const a = await appAlpha.inject({ method: 'GET', url: '/api/v1/data' });
        alphaStatuses.push(a.statusCode);

        const b = await appBeta.inject({ method: 'GET', url: '/api/v1/data' });
        betaStatuses.push(b.statusCode);
      }

      expect(alphaStatuses.every((s) => s === 200)).toBe(true);
      expect(betaStatuses.every((s) => s === 200)).toBe(true);
    } finally {
      await appAlpha.close();
      await appBeta.close();
    }
  });

  it('exhausting user-alpha does NOT rate-limit user-beta (separate apps)', async () => {
    const appAlpha = await buildRateLimitApp({ id: 'user-alpha-exhaust' });
    const appBeta = await buildRateLimitApp({ id: 'user-beta-fresh' });

    try {
      for (let i = 0; i < 10; i++) {
        await appAlpha.inject({ method: 'GET', url: '/api/v1/data' });
      }

      const alphaBlocked = await appAlpha.inject({ method: 'GET', url: '/api/v1/data' });
      expect(alphaBlocked.statusCode).toBe(429);

      const betaOk = await appBeta.inject({ method: 'GET', url: '/api/v1/data' });
      expect(betaOk.statusCode).toBe(200);
    } finally {
      await appAlpha.close();
      await appBeta.close();
    }
  });
});
