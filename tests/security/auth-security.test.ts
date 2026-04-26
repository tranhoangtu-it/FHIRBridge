/**
 * Security tests — Authentication hardening.
 * Covers: alg:none JWT, tampered payload, timing-safe API key comparison, CORS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestServer,
  bearerHeader,
  TEST_JWT_SECRET,
  makeJwt,
  PROTECTED_PROBE_URL,
} from '../integration/helpers.js';

let server: FastifyInstance;

const PROBE_PAYLOAD = {
  type: 'fhir-endpoint',
  baseUrl: 'https://hapi.fhir.org/baseR4',
};

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

// ---------------------------------------------------------------------------
// JWT algorithm confusion — alg:none
// ---------------------------------------------------------------------------

describe('JWT — alg:none attack', () => {
  it('unsigned token (alg: none) is rejected with 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ id: 'attacker', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(noneToken), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('empty signature with valid header/payload returns 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'attacker' })).toString('base64url');
    const truncated = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(truncated), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// JWT payload tampering
// ---------------------------------------------------------------------------

describe('JWT — tampered payload', () => {
  it('legit token with manually swapped payload is rejected', async () => {
    const legitToken = makeJwt({ id: 'user-original' });
    const parts = legitToken.split('.');

    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: 'user-impersonated', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(tampered), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('token re-signed with wrong key is rejected', async () => {
    const wrongKeyToken = makeJwt({ id: 'user-x' }, 'wrong-key-not-the-real-secret');
    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(wrongKeyToken), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('correct secret but wrong algorithm hint (RS256 header, HS256 signed) is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ id: 'x', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', TEST_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const mismatch = `${header}.${payload}.${sig}`;

    const res = await server.inject({
      method: 'POST',
      url: PROTECTED_PROBE_URL,
      headers: { authorization: bearerHeader(mismatch), 'content-type': 'application/json' },
      payload: PROBE_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API key timing safety
// ---------------------------------------------------------------------------

describe('API key — constant-time comparison', () => {
  async function measureMedianMs(key: string, runs = 10): Promise<number> {
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      await server.inject({
        method: 'POST',
        url: PROTECTED_PROBE_URL,
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        payload: PROBE_PAYLOAD,
      });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)]!;
  }

  it('response time for valid-prefix key and random key are similar (within 50ms)', async () => {
    const validPrefixKey = 'test-key-xxxxxxxxxxxxxxxxx';
    const randomKey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzz';

    const [medianPrefix, medianRandom] = await Promise.all([
      measureMedianMs(validPrefixKey),
      measureMedianMs(randomKey),
    ]);

    const diff = Math.abs(medianPrefix - medianRandom);
    expect(diff).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// CORS — malicious origin must not be reflected
// ---------------------------------------------------------------------------

describe('CORS — malicious origin not reflected', () => {
  it('request from disallowed origin does not include ACAO header matching that origin', async () => {
    const maliciousOrigin = 'https://evil.attacker.example.com';
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: maliciousOrigin },
    });

    const acao = res.headers['access-control-allow-origin'];
    if (acao !== undefined) {
      expect(acao).not.toBe(maliciousOrigin);
    }
  });

  it('preflight from disallowed origin is rejected or returns no ACAO for that origin', async () => {
    const res = await server.inject({
      method: 'OPTIONS',
      url: '/api/v1/export',
      headers: {
        origin: 'https://phishing.example.net',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    const acao = res.headers['access-control-allow-origin'];
    if (acao !== undefined) {
      expect(acao).not.toBe('https://phishing.example.net');
    }
  });
});
