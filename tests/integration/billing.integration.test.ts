/**
 * Integration tests — Billing routes.
 * Verifies plans list format and usage record shape.
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

describe('GET /api/v1/billing/plans', () => {
  it('returns 200 with an array of plans', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    expect(res.statusCode).toBe(200);
    const plans = res.json();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThanOrEqual(2);
  });

  it('response includes a free plan', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(freeUserJwt()) },
    });
    const plans: Array<{ id?: string; tier?: string }> = res.json();
    const freePlan = plans.find((p) => p.id === 'free' || p.tier === 'free');
    expect(freePlan).toBeDefined();
  });

  it('response includes a paid plan', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/plans',
      headers: { authorization: bearerHeader(paidUserJwt()) },
    });
    const plans: Array<{ id?: string; tier?: string }> = res.json();
    const paidPlan = plans.find((p) => p.id === 'paid' || p.tier === 'paid');
    expect(paidPlan).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/billing/usage', () => {
  it('returns usage record with expected fields', async () => {
    const token = makeJwt({ id: `usage-user-${Date.now()}`, tier: 'paid' });
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
      headers: { authorization: bearerHeader(token) },
    });
    expect(res.statusCode).toBe(200);
    const usage = res.json();
    expect(usage).toHaveProperty('userId');
    expect(usage).toHaveProperty('period');
    expect(usage).toHaveProperty('exportCount');
    expect(usage).toHaveProperty('aiSummaryCount');
  });

  it('period is in YYYY-MM format', async () => {
    const token = makeJwt({ id: `usage-period-${Date.now()}`, tier: 'paid' });
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
      headers: { authorization: bearerHeader(token) },
    });
    const { period } = res.json() as { period: string };
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('exportCount and aiSummaryCount are numbers', async () => {
    const token = makeJwt({ id: `usage-counts-${Date.now()}`, tier: 'paid' });
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
      headers: { authorization: bearerHeader(token) },
    });
    const usage = res.json() as { exportCount: unknown; aiSummaryCount: unknown };
    expect(typeof usage.exportCount).toBe('number');
    expect(typeof usage.aiSummaryCount).toBe('number');
  });

  it('usage reflects recorded exports', async () => {
    const userId = `usage-reflect-${Date.now()}`;
    const token = makeJwt({ id: userId, tier: 'paid' });

    // Check baseline
    const beforeRes = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
      headers: { authorization: bearerHeader(token) },
    });
    const before = beforeRes.json() as { exportCount: number };
    const baseCount = before.exportCount;

    // Initiate an export
    await server.inject({
      method: 'POST',
      url: '/api/v1/export',
      headers: { authorization: bearerHeader(token), 'content-type': 'application/json' },
      payload: {
        patientId: 'p1',
        connectorConfig: { type: 'fhir-endpoint', baseUrl: 'https://hapi.fhir.org/baseR4' },
      },
    });

    // Usage should increase
    const afterRes = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
      headers: { authorization: bearerHeader(token) },
    });
    const after = afterRes.json() as { exportCount: number };
    expect(after.exportCount).toBe(baseCount + 1);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/billing/usage' });
    expect(res.statusCode).toBe(401);
  });
});
