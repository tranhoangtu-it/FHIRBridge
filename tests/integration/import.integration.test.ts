/**
 * Integration tests — Connector routes.
 * Tests /api/v1/connectors/test (SSRF guard) and /api/v1/connectors/import (multipart guard).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, userJwt, bearerHeader } from './helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('POST /api/v1/connectors/test', () => {
  it('returns connection status object (external URL, connection may fail)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'https://hapi.fhir.org/baseR4' },
      },
    });
    // Returns 200 either way (connected: true/false) — network errors are swallowed
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.connected).toBe('boolean');
    expect(body.checkedAt).toBeDefined();
  });

  it('blocks SSRF — 169.254.169.254 (AWS metadata)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'http://169.254.169.254/latest/meta-data/' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/Internal endpoints are not allowed/);
  });

  it('blocks SSRF — localhost', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'http://localhost:9200/' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/Internal endpoints are not allowed/);
  });

  it('blocks SSRF — private IP range 192.168.x.x', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'http://192.168.1.100/fhir' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/Private IP ranges are not allowed/);
  });

  it('returns 400 when config.baseUrl is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: {
        type: 'fhir-endpoint',
        config: {},
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      headers: { 'content-type': 'application/json' },
      payload: { type: 'fhir-endpoint', config: { baseUrl: 'https://example.com' } },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/connectors/import', () => {
  it('returns 400 when request is not multipart', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/import',
      headers: {
        authorization: bearerHeader(userJwt()),
        'content-type': 'application/json',
      },
      payload: { data: 'not-multipart' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.message).toMatch(/multipart/i);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/connectors/import',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});
