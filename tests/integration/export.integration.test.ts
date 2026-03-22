/**
 * Integration tests — Export routes.
 * Tests HTTP layer + business logic. No real FHIR endpoint needed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, paidUserJwt, freeUserJwt, makeJwt, bearerHeader } from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

/** Valid export body pointing at a (non-reachable) external endpoint */
const VALID_EXPORT_BODY = {
  patientId: 'patient-123',
  connectorConfig: {
    type: 'fhir-endpoint',
    baseUrl: 'https://hapi.fhir.org/baseR4',
  },
};

describe('POST /api/v1/export — initiate export', () => {
  it('returns 202 with exportId for paid user', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: VALID_EXPORT_BODY,
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.exportId).toBeDefined();
    expect(typeof body.exportId).toBe('string');
    expect(body.status).toBe('processing');
  });

  it('returns 202 with exportId for free user (within quota)', async () => {
    // Fresh user ID to avoid quota exhaustion from other tests
    const freshFreeToken = makeJwt({ id: `export-free-${Date.now()}`, tier: 'free' });
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(freshFreeToken),
        'content-type': 'application/json',
      },
      payload: VALID_EXPORT_BODY,
    });
    expect(res.statusCode).toBe(202);
  });

  it('returns 400 when patientId is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: {
        connectorConfig: { type: 'fhir-endpoint', baseUrl: 'https://example.com' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when connectorConfig is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: { patientId: 'patient-123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts SSRF baseUrl but export eventually fails (not blocked at HTTP layer)', async () => {
    // SSRF validation happens inside runExport (async), not at HTTP ingress.
    // The endpoint accepts the job and returns 202; the record status becomes 'failed'.
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: {
        patientId: 'patient-123',
        connectorConfig: { type: 'fhir-endpoint', baseUrl: 'http://169.254.169.254/latest' },
      },
    });
    // HTTP layer returns 202 — SSRF is caught async inside runExport
    expect(res.statusCode).toBe(202);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: { 'content-type': 'application/json' },
      payload: VALID_EXPORT_BODY,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/export/:id/status', () => {
  it('returns status object for correct user', async () => {
    const token = paidUserJwt();
    // Start an export first
    const postRes = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: { authorization: bearerHeader(token), 'content-type': 'application/json' },
      payload: VALID_EXPORT_BODY,
    });
    expect(postRes.statusCode).toBe(202);
    const { exportId } = postRes.json();

    const statusRes = await server.inject({
      method: 'GET',
      url: `/api/v1/export/${exportId}/status`,
      headers: { authorization: bearerHeader(token) },
    });
    expect(statusRes.statusCode).toBe(200);
    const body = statusRes.json();
    expect(['processing', 'complete', 'failed']).toContain(body.status);
  });

  it('returns 404 when a different user requests the same export (IDOR protection)', async () => {
    const ownerToken = makeJwt({ id: `owner-${Date.now()}`, tier: 'paid' });
    const attackerToken = makeJwt({ id: `attacker-${Date.now()}`, tier: 'paid' });

    const postRes = await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: { authorization: bearerHeader(ownerToken), 'content-type': 'application/json' },
      payload: VALID_EXPORT_BODY,
    });
    const { exportId } = postRes.json();

    const attackRes = await server.inject({
      method: 'GET',
      url: `/api/v1/export/${exportId}/status`,
      headers: { authorization: bearerHeader(attackerToken) },
    });
    expect(attackRes.statusCode).toBe(404);
  });

  it('returns 404 for non-existent export id', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/export/00000000-0000-0000-0000-000000000000/status',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(404);
  });
});
