/**
 * Tests cho security-headers-plugin (Fix C-3).
 * Kiểm tra helmet headers được set đúng trên các routes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { securityHeadersPlugin } from '../security-headers-plugin.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(securityHeadersPlugin);

  app.get('/api/v1/test', async (_req, reply) => reply.send({ ok: true }));

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Security headers — normal routes', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sets Strict-Transport-Security with long max-age', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    const hsts = res.headers['strict-transport-security'] as string;
    expect(hsts).toBeDefined();
    expect(hsts).toMatch(/max-age=31536000/);
    expect(hsts).toMatch(/includeSubDomains/);
  });

  it('sets Content-Security-Policy', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('sets Referrer-Policy', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
