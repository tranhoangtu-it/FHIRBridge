/**
 * Integration tests — Audit plugin.
 * Without real Postgres, audit goes to ConsoleAuditSink.
 * Tests that requests complete (no crash) and X-Request-Id is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, paidUserJwt, bearerHeader } from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('Audit — request tracing', () => {
  it('every response includes X-Request-Id header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(200);
    const requestId = res.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    expect((requestId as string).length).toBeGreaterThan(0);
  });

  it('health endpoint response includes X-Request-Id', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('request with supplied X-Request-Id is echoed back', async () => {
    const customId = 'test-trace-id-abc123';
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'x-request-id': customId,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('audit does not crash server when ConsoleAuditSink is used (no Postgres)', async () => {
    // Make several requests — if audit plugin throws, server would respond 500
    for (let i = 0; i < 3; i++) {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/billing/usage',
        headers: { authorization: bearerHeader(paidUserJwt()) },
      });
      expect(res.statusCode).not.toBe(500);
    }
  });

  it('unauthenticated request still gets X-Request-Id before 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
