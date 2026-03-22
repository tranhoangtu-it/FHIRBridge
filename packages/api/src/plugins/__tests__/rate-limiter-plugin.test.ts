/**
 * Tests for rate-limiter plugin — tier limits, allowList for health.
 * Uses Fastify inject() with in-memory store (no Redis URL provided).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from '../rate-limiter-plugin.js';
import type { AuthUser } from '../../plugins/auth-plugin.js';

// Build a Fastify instance with rate limiter and a mock auth user
async function buildApp(user: AuthUser | null): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorateRequest('authUser', null);

  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser | null }).authUser = user;
  });

  // No redisUrl — uses in-memory store
  await app.register(rateLimiterPlugin, {});

  app.get('/api/v1/data', async () => ({ ok: true }));
  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  await app.ready();
  return app;
}

describe('Rate limiter plugin — free tier (10 req/min)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'free-user-rl', tier: 'free' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows initial requests within free tier limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.statusCode).toBe(200);
  });

  it('sets x-ratelimit-limit header to free tier value (10)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.headers['x-ratelimit-limit']).toBe('10');
  });

  it('returns 429 after exhausting free tier limit', async () => {
    // free tier = 10 req/min; drain remaining
    let lastStatus = 200;
    for (let i = 0; i < 15; i++) {
      const r = await app.inject({ method: 'GET', url: '/api/v1/data' });
      lastStatus = r.statusCode;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('Rate limiter plugin — paid tier (100 req/min)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'paid-user-rl', tier: 'paid' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows requests within paid tier limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.statusCode).toBe(200);
  });

  it('sets x-ratelimit-limit header to paid tier value (100)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/data' });
    expect(res.headers['x-ratelimit-limit']).toBe('100');
  });

  it('does NOT rate limit within first 10 requests (paid allows more)', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => app.inject({ method: 'GET', url: '/api/v1/data' })),
    );
    const tooMany = results.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBe(0);
  });
});

describe('Rate limiter plugin — /health allowList', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ id: 'any-user', tier: 'free' });
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
