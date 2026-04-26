/**
 * Integration tests — Audit plugin.
 * Without real Postgres, audit goes to ConsoleAuditSink.
 * Tests that requests complete (no crash) and X-Request-Id is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, userJwt, bearerHeader, PROTECTED_PROBE_URL } from './helpers.js';

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

describe('Audit — request tracing', () => {
  it('every response includes X-Request-Id header', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: {
        authorization: bearerHeader(userJwt('audit-1')),
        'content-type': 'application/json',
      },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).not.toBe(500);
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
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: {
        authorization: bearerHeader(userJwt('audit-2')),
        'x-request-id': customId,
        'content-type': 'application/json',
      },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).not.toBe(500);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('audit does not crash server when ConsoleAuditSink is used (no Postgres)', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await server.inject({
        method: 'POST',
        url: PROTECTED_PROBE_URL,
        headers: {
          authorization: bearerHeader(userJwt(`audit-loop-${i}`)),
          'content-type': 'application/json',
        },
        payload: PROBE_PAYLOAD,
      });
      expect(res.statusCode).not.toBe(500);
    }
  });

  it('unauthenticated request still gets X-Request-Id before 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
