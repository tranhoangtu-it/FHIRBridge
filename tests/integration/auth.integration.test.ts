/**
 * Integration tests — Authentication layer.
 * Verifies JWT and API key auth on the full Fastify server (no Docker).
 * Uses /api/v1/connectors/test as the generic protected probe target.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestServer,
  userJwt,
  makeJwt,
  bearerHeader,
  TEST_JWT_SECRET,
  PROTECTED_PROBE_URL,
} from './helpers.js';

const PROBE_PAYLOAD = {
  type: 'fhir-endpoint',
  baseUrl: 'https://hapi.fhir.org/baseR4',
};

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
  it('valid JWT does not get rejected as unauthorized', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(userJwt()) },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('expired JWT returns 401', async () => {
    const expired = makeJwt({ id: 'user-x' }, TEST_JWT_SECRET, { expiresIn: -1 });
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(expired) },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('JWT signed with wrong secret returns 401', async () => {
    const wrongKey = makeJwt({ id: 'user-x' }, 'completely-different-secret-value');
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(wrongKey) },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('JWT with alg:none (unsigned) returns 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'hacker' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(noneToken) },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — API key (X-API-Key header)', () => {
  it('valid API key does not get rejected as unauthorized', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { 'x-api-key': 'test-key-1' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('invalid API key returns 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { 'x-api-key': 'invalid-key-not-in-config' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — missing credentials', () => {
  it('no auth header returns 401 on protected route', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('no auth header returns 401 on export', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/export', payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
