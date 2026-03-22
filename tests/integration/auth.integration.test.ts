/**
 * Integration tests — Authentication layer.
 * Verifies JWT and API key auth on the full Fastify server (no Docker).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestServer,
  freeUserJwt,
  paidUserJwt,
  makeJwt,
  bearerHeader,
  TEST_JWT_SECRET,
} from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('Auth — public endpoints', () => {
  it('GET /api/v1/health returns 200 without any auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
  });
});

describe('Auth — JWT bearer token', () => {
  it('valid JWT returns 200 on protected route', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('expired JWT returns 401', async () => {
    const expired = makeJwt({ id: 'user-x', tier: 'free' }, TEST_JWT_SECRET, { expiresIn: -1 });
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(expired) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('JWT signed with wrong secret returns 401', async () => {
    const wrongKey = makeJwt({ id: 'user-x', tier: 'free' }, 'completely-different-secret-value');
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(wrongKey) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('JWT with alg:none (unsigned) returns 401', async () => {
    // Craft a fake "none" algorithm token manually (header.payload.empty-signature)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'hacker', tier: 'paid' })).toString(
      'base64url',
    );
    const noneToken = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(noneToken) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('free tier JWT returns 200 on billing plans', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(freeUserJwt()) },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Auth — API key (X-API-Key header)', () => {
  it('valid API key returns 200', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { 'x-api-key': 'test-key-paid' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('invalid API key returns 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { 'x-api-key': 'invalid-key-not-in-config' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — missing credentials', () => {
  it('no auth header returns 401 on protected route', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(res.statusCode).toBe(401);
  });

  it('no auth header returns 401 on billing usage', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/usage' });
    expect(res.statusCode).toBe(401);
  });

  it('no auth header returns 401 on export', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/export', payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
