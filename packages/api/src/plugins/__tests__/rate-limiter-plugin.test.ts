/**
 * Tests for rate-limiter plugin — single global budget, allowList for health.
 * Uses Fastify inject() with in-memory store (no Redis URL provided).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from '../rate-limiter-plugin.js';
import type { AuthUser } from '../../plugins/auth-plugin.js';

// Build a Fastify instance with rate limiter and a mock auth user
async function buildApp(user: AuthUser | null, maxPerMinute?: number): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorateRequest('authUser', null);

  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser | null }).authUser = user;
  });

  await app.register(rateLimiterPlugin, maxPerMinute !== undefined ? { maxPerMinute } : {});

  app.get('/api/v1/data', async () => ({ ok: true }));
  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  await app.ready();
  return app;
}

describe('Rate limiter plugin — default budget (100 req/min)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'user-rl' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows initial requests within budget', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.statusCode).toBe(200);
  });

  it('sets x-ratelimit-limit header to default value (100)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.headers['x-ratelimit-limit']).toBe('100');
  });

  it('does NOT rate limit within first 10 requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => app.inject({ method: 'GET', url: '/api/v1/data' })),
    );
    const tooMany = results.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBe(0);
  });
});

describe('Rate limiter plugin — explicit cap (10 req/min)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'tight-user' }, 10);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exhausting the tighter budget', async () => {
    let lastStatus = 200;
    for (let i = 0; i < 15; i++) {
      const r = await app.inject({ method: 'GET', url: '/api/v1/data' });
      lastStatus = r.statusCode;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('Rate limiter plugin — /health allowList', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'any-user' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('never rate-limits /api/v1/health even after many requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => app.inject({ method: 'GET', url: '/api/v1/health' })),
    );
    const allOk = results.every((r) => r.statusCode === 200);
    expect(allOk).toBe(true);
  });
});
