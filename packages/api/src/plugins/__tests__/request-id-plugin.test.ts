/**
 * Tests for request-id plugin — trace ID propagation and generation.
 * Uses Fastify inject() — no network.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { requestIdPlugin } from '../request-id-plugin.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(requestIdPlugin);
  app.get('/test', async (req) => ({ id: (req as unknown as { id?: string }).id }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Request ID plugin — generation', () => {
  it('generates a UUID X-Request-Id when header is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    const xId = res.headers['x-request-id'];
    expect(typeof xId).toBe('string');
    expect(UUID_RE.test(xId as string)).toBe(true);
  });

  it('generates different IDs for successive requests', async () => {
    const [r1, r2] = await Promise.all([
      app.inject({ method: 'GET', url: '/test' }),
      app.inject({ method: 'GET', url: '/test' }),
    ]);
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
  });
});

describe('Request ID plugin — propagation', () => {
  it('propagates provided X-Request-Id header unchanged', async () => {
    const incomingId = 'my-custom-trace-id-abc123';
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': incomingId },
    });
    expect(res.headers['x-request-id']).toBe(incomingId);
  });

  it('sets request.id to the propagated value', async () => {
    const incomingId = 'trace-12345';
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': incomingId },
    });
    expect(res.json().id).toBe(incomingId);
  });

  it('always echoes X-Request-Id in response header', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
