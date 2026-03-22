/**
 * Security tests — HTTP response header hygiene.
 * Covers: Server header info-leak, stack traces in error bodies, Content-Type correctness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, paidUserJwt, bearerHeader } from '../integration/helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

// ---------------------------------------------------------------------------
// Server header — must not expose version/technology fingerprint
// ---------------------------------------------------------------------------

describe('Response headers — Server header info-leak', () => {
  it('GET /api/v1/health does not expose detailed Server header', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    const serverHeader = res.headers['server'];
    // If the header exists it must not include version numbers or "fastify"
    if (serverHeader) {
      expect(serverHeader).not.toMatch(/fastify\/\d/i);
      expect(serverHeader).not.toMatch(/node\/\d/i);
      expect(serverHeader).not.toMatch(/v\d+\.\d+\.\d+/);
    }
  });

  it('401 error response does not expose Server version', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    const serverHeader = res.headers['server'];
    if (serverHeader) {
      expect(serverHeader).not.toMatch(/\d+\.\d+\.\d+/);
    }
  });
});

// ---------------------------------------------------------------------------
// Error responses must not include stack traces
// ---------------------------------------------------------------------------

describe('Error responses — no stack traces', () => {
  it('404 response body does not contain a stack trace', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/does-not-exist-route-xyz',
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toMatch(/at Object\.<anonymous>/);
    expect(res.body).not.toMatch(/at Module\._compile/);
    expect(res.body).not.toMatch(/node:internal/);
  });

  it('401 response body does not contain a stack trace', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(res.statusCode).toBe(401);
    const body = res.json<Record<string, unknown>>();
    expect(body).not.toHaveProperty('stack');
    expect(res.body).not.toMatch(/at \w+\.js:\d+:\d+/);
  });

  it('422/400 validation error body does not contain a stack trace', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      // Intentionally missing required fields to trigger schema validation error
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
    expect(res.body).not.toMatch(/at Object\.<anonymous>/);
    expect(res.body).not.toMatch(/node_modules/);
    const body = res.json<Record<string, unknown>>();
    expect(body).not.toHaveProperty('stack');
  });

  it('malformed JSON body produces 400 without stack trace', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: '{ not valid json :::',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toMatch(/SyntaxError/);
    expect(res.body).not.toMatch(/at JSON\.parse/);
  });
});

// ---------------------------------------------------------------------------
// Content-Type header on all JSON responses
// ---------------------------------------------------------------------------

describe('Response headers — Content-Type correctness', () => {
  it('GET /api/v1/health returns application/json Content-Type', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('401 error response has application/json Content-Type', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('404 error response has application/json Content-Type', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/nonexistent' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('200 billing plans response has application/json Content-Type', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// X-Powered-By — must not expose technology stack
// ---------------------------------------------------------------------------

describe('Response headers — X-Powered-By absent', () => {
  it('health endpoint does not send X-Powered-By header', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
