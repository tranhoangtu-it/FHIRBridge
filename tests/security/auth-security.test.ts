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
} from '../integration/helpers.js';

let server: FastifyInstance;

/** A protected route that requires any valid auth */
const PROTECTED = '/api/v1/billing/plans';

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
      JSON.stringify({ id: 'attacker', tier: 'paid', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'GET',
      url: PROTECTED,
      headers: { authorization: bearerHeader(noneToken) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('empty signature with valid header/payload returns 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'attacker', tier: 'paid' })).toString(
      'base64url',
    );
    const truncated = `${header}.${payload}.`;

    const res = await server.inject({
      method: 'GET',
      url: PROTECTED,
      headers: { authorization: bearerHeader(truncated) },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// JWT payload tampering
// ---------------------------------------------------------------------------

describe('JWT — tampered payload (tier escalation)', () => {
  it('free-tier token with manually patched tier=paid is rejected', async () => {
    // Sign a legit free token then swap the payload bytes before sending
    const legitToken = makeJwt({ id: 'user-escalate', tier: 'free' });
    const parts = legitToken.split('.');

    // Replace payload with paid-tier payload (different signature won't match)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: 'user-escalate', tier: 'paid', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await server.inject({
      method: 'GET',
      url: PROTECTED,
      headers: { authorization: bearerHeader(tampered) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('token re-signed with wrong key is rejected', async () => {
    const wrongKeyToken = makeJwt({ id: 'user-x', tier: 'paid' }, 'wrong-key-not-the-real-secret');
    const res = await server.inject({
      method: 'GET',
      url: PROTECTED,
      headers: { authorization: bearerHeader(wrongKeyToken) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('correct secret but wrong algorithm hint (RS256 header, HS256 signed) is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ id: 'x', tier: 'paid', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    // Signature is computed via HS256 but header says RS256 — mismatch
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', TEST_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const mismatch = `${header}.${payload}.${sig}`;

    const res = await server.inject({
      method: 'GET',
      url: PROTECTED,
      headers: { authorization: bearerHeader(mismatch) },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API key timing safety
// ---------------------------------------------------------------------------

describe('API key — constant-time comparison', () => {
  /**
   * Measures the median response time (ms) across `runs` requests.
   * We compare a valid-prefix key vs a completely random key.
   * The difference should be small (< 50ms) if comparison is constant-time.
   * This is a best-effort signal — true constant-time is enforced by the Set.has()
   * implementation which doesn't short-circuit on prefix match.
   */
  async function measureMedianMs(key: string, runs = 10): Promise<number> {
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      await server.inject({ method: 'GET', url: PROTECTED, headers: { 'x-api-key': key } });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)]!;
  }

  it('response time for valid-prefix key and random key are similar (within 50ms)', async () => {
    // "test-key-" is a valid prefix of a real key ("test-key-free" / "test-key-paid")
    const validPrefixKey = 'test-key-xxxxxxxxxxxxxxxxx';
    const randomKey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzz';

    const [medianPrefix, medianRandom] = await Promise.all([
      measureMedianMs(validPrefixKey),
      measureMedianMs(randomKey),
    ]);

    const diff = Math.abs(medianPrefix - medianRandom);
    // 50ms is generous for a local server — the real diff should be <1ms
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
    // Must not echo back the malicious origin
    if (acao !== undefined) {
      expect(acao).not.toBe(maliciousOrigin);
      // Wildcard is acceptable only on public endpoints with no credentials
      // For a JWT-protected API, wildcard+credentials is insecure but health is public
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
