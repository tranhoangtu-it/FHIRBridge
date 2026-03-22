/**
 * Integration tests — Summary routes.
 * Verifies tier gating (free -> 402, paid -> 202) and input validation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestServer,
  freeUserJwt,
  paidUserJwt,
  makeJwt,
  bearerHeader,
  MINIMAL_BUNDLE,
} from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('POST /api/v1/summary/generate', () => {
  it('paid user with valid bundle returns 202', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: { bundle: MINIMAL_BUNDLE },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.summaryId).toBeDefined();
    expect(typeof body.summaryId).toBe('string');
    expect(body.status).toBe('processing');
  });

  it('free tier user receives 402 (AI summaries not included)', async () => {
    // Fresh user to avoid rate-limit interactions
    const freshFreeToken = makeJwt({ id: `summary-free-${Date.now()}`, tier: 'free' });
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: {
        authorization: bearerHeader(freshFreeToken),
        'content-type': 'application/json',
      },
      payload: { bundle: MINIMAL_BUNDLE },
    });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error).toBe('Payment Required');
  });

  it('missing bundle field returns 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('empty body returns 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: null,
    });
    // Fastify rejects empty body for routes that expect JSON
    expect([400, 415]).toContain(res.statusCode);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: { 'content-type': 'application/json' },
      payload: { bundle: MINIMAL_BUNDLE },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/summary/:id/download', () => {
  it('returns 404 for non-existent summary id', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/summary/00000000-0000-0000-0000-000000000000/download',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 (Conflict) if summary is still processing', async () => {
    // Start a summary job
    const postRes = await server.inject({
      method: 'POST',
      url: '/api/v1/summary/generate',
      headers: {
        authorization: bearerHeader(paidUserJwt()),
        'content-type': 'application/json',
      },
      payload: { bundle: MINIMAL_BUNDLE },
    });
    expect(postRes.statusCode).toBe(202);
    const { summaryId } = postRes.json();

    // Immediately try to download — will be 'processing' still
    const downloadRes = await server.inject({
      method: 'GET',
      url: `/api/v1/summary/${summaryId}/download`,
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    // Either 409 (still processing) or 200 (completed fast) — both valid
    expect([200, 409]).toContain(downloadRes.statusCode);
  });
});
