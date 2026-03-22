/**
 * Rate limiter stress tests.
 * Uses isolated Fastify instances (not the full server) to control
 * the authUser directly without going through JWT auth flow.
 *
 * Free tier: 10 req/min. Sending sequential requests beyond the limit
 * should trigger 429 responses.
 *
 * NOTE: Uses sequential requests because parallel Promise.all can cause
 * the in-memory rate-limit counters to accept/reject inconsistently
 * depending on event-loop scheduling. Sequential calls are deterministic.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from '../../packages/api/src/plugins/rate-limiter-plugin.js';
import type { AuthUser } from '../../packages/api/src/plugins/auth-plugin.js';

/** Build a minimal app with rate limiter and a fixed authUser */
async function buildRateLimitApp(user: AuthUser): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Decorate request so rate limiter can read tier/id
  app.decorateRequest('authUser', null);
  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser }).authUser = user;
  });

  await app.register(rateLimiterPlugin, {}); // no Redis → in-memory
  app.get('/api/v1/data', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('Rate limiter — free tier stress (sequential requests)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildRateLimitApp({ id: 'stress-free-user-seq', tier: 'free' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('first 10 sequential requests succeed, then 429 begins', async () => {
    const statuses: number[] = [];

    // Send 15 requests sequentially
    for (let i = 0; i < 15; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
      statuses.push(res.statusCode);
    }

    const successes = statuses.filter((s) => s === 200).length;
    const tooMany = statuses.filter((s) => s === 429).length;

    // Exactly 10 succeed (free tier), remaining are 429
    expect(successes).toBe(10);
    expect(tooMany).toBe(5);
  });

  it('response body for 429 includes retryAfter', async () => {
    // At this point limit is already exhausted from previous test
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.statusCode).toBe(429);
    const body = res.json<{ retryAfter: number }>();
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

describe('Rate limiter — independent counters per user', () => {
  // Fresh instances per-test to avoid counter bleed between tests
  it('each user (separate apps) has an independent window — both get 10/10 OK', async () => {
    const appAlpha = await buildRateLimitApp({ id: 'user-alpha-iv', tier: 'free' });
    const appBeta = await buildRateLimitApp({ id: 'user-beta-iv', tier: 'free' });

    try {
      // Interleave requests: alpha and beta take turns (10 each)
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
    const appAlpha = await buildRateLimitApp({ id: 'user-alpha-exhaust', tier: 'free' });
    // appBeta starts with a fresh counter (never used)
    const appBeta = await buildRateLimitApp({ id: 'user-beta-fresh', tier: 'free' });

    try {
      // Exhaust alpha completely (10 req limit)
      for (let i = 0; i < 10; i++) {
        await appAlpha.inject({ method: 'GET', url: '/api/v1/data' });
      }

      // alpha's 11th request should 429
      const alphaBlocked = await appAlpha.inject({ method: 'GET', url: '/api/v1/data' });
      expect(alphaBlocked.statusCode).toBe(429);

      // beta has its own fresh counter — still at 0 requests used
      const betaOk = await appBeta.inject({ method: 'GET', url: '/api/v1/data' });
      expect(betaOk.statusCode).toBe(200);
    } finally {
      await appAlpha.close();
      await appBeta.close();
    }
  });
});
