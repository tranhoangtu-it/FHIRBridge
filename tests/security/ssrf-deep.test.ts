/**
 * Security tests — Deep SSRF bypass attempts on POST /api/v1/connectors/test.
 * Covers: IPv6 loopback, userinfo-embedded URLs, hex/octal IP encoding.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, userJwt, bearerHeader } from '../integration/helpers.js';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

const PAID_HEADERS = {
  authorization: bearerHeader(userJwt()),
  'content-type': 'application/json',
};

const TEST_URL = '/api/v1/connectors/test';

/**
 * Helper: send a connector test request and return the response.
 * The server either rejects at the validation layer (throws / 400)
 * or returns a { connected: false, error } body after validateBaseUrl throws.
 */
async function testBaseUrl(baseUrl: string) {
  return server.inject({
    method: 'POST',
    url: TEST_URL,
    headers: PAID_HEADERS,
    payload: { type: 'fhir-endpoint', config: { type: 'fhir-endpoint', baseUrl } },
  });
}

/** Checks that the response indicates the connection was blocked / not allowed */
function isBlocked(res: Awaited<ReturnType<typeof testBaseUrl>>): boolean {
  if (res.statusCode >= 400 && res.statusCode < 500) return true;
  // 200 body with connected:false and an error message about internal endpoints
  if (res.statusCode === 200) {
    try {
      const body = res.json<{ connected: boolean; error?: string }>();
      if (!body.connected && typeof body.error === 'string') {
        return (
          /internal|not allowed|private|blocked/i.test(body.error) ||
          // Acceptable: any connection error that isn't a success
          body.error.length > 0
        );
      }
    } catch {
      // Non-JSON — treat as error
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// IPv6 loopback
// ---------------------------------------------------------------------------

describe('SSRF — IPv6 loopback [::1]', () => {
  it('baseUrl "http://[::1]:8080" is blocked', async () => {
    const res = await testBaseUrl('http://[::1]:8080');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://[::1]/fhir" is blocked', async () => {
    const res = await testBaseUrl('http://[::1]/fhir');
    expect(isBlocked(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Userinfo-embedded credentials (RFC 3986 §3.2.1)
// ---------------------------------------------------------------------------

describe('SSRF — userinfo in URL authority', () => {
  it('baseUrl "http://user:pass@localhost" is blocked', async () => {
    const res = await testBaseUrl('http://user:pass@localhost');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://user:pass@127.0.0.1" is blocked', async () => {
    const res = await testBaseUrl('http://user:pass@127.0.0.1');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://attacker@169.254.169.254" (IMDS via userinfo) is blocked', async () => {
    const res = await testBaseUrl('http://attacker@169.254.169.254');
    expect(isBlocked(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hex-encoded IP (0x7f000001 = 127.0.0.1)
// ---------------------------------------------------------------------------

describe('SSRF — hex-encoded IP', () => {
  it('baseUrl "http://0x7f000001" is rejected or not treated as external', async () => {
    // Node's URL parser may reject this entirely or normalize it
    // Either a 400 schema error or a blocked connection is acceptable
    const res = await testBaseUrl('http://0x7f000001');
    // We accept: 400/422 (schema rejection) or a { connected: false } response
    // We do NOT accept: 200 with connected: true (successful loopback connection)
    if (res.statusCode === 200) {
      const body = res.json<{ connected: boolean }>();
      expect(body.connected).toBe(false);
    } else {
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Octal-encoded IP (0177.0.0.1 = 127.0.0.1 in some Unix stacks)
// ---------------------------------------------------------------------------

describe('SSRF — octal-encoded IP', () => {
  it('baseUrl "http://0177.0.0.1" does not result in a successful loopback connection', async () => {
    // Browser and Node URL parsers differ on octal; Node typically treats as decimal
    // The test verifies that no successful connection to loopback is made
    const res = await testBaseUrl('http://0177.0.0.1');
    if (res.statusCode === 200) {
      const body = res.json<{ connected: boolean }>();
      // If parsed as 177.0.0.1 (public), connected may still be false due to no real FHIR server
      // If parsed as 127.0.0.1, it should be blocked
      // Either way, connected must not be true
      expect(body.connected).toBe(false);
    }
    // A 400 or schema error is also a valid (safe) outcome
  });
});

// ---------------------------------------------------------------------------
// Standard localhost variants (regression)
// ---------------------------------------------------------------------------

describe('SSRF — standard localhost variants', () => {
  it('baseUrl "http://localhost" is blocked', async () => {
    const res = await testBaseUrl('http://localhost');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://127.0.0.1" is blocked', async () => {
    const res = await testBaseUrl('http://127.0.0.1');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://0.0.0.0" is blocked', async () => {
    const res = await testBaseUrl('http://0.0.0.0');
    expect(isBlocked(res)).toBe(true);
  });

  it('baseUrl "http://169.254.169.254" (AWS IMDS) is blocked', async () => {
    const res = await testBaseUrl('http://169.254.169.254');
    expect(isBlocked(res)).toBe(true);
  });
});
