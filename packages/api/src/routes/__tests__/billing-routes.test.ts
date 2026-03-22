/**
 * Tests for billing routes:
 *   GET /api/v1/billing/plans  — list plans (no auth required in test)
 *   GET /api/v1/billing/usage  — get usage for authenticated user
 *
 * Uses Fastify inject() — no network or real payment processing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { billingRoutes } from '../billing-routes.js';

// Minimal Fastify instance without auth plugin — we inject authUser directly
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Decorate authUser on request so route handlers can access it
  app.decorateRequest('authUser', null);

  // Inject a mock authenticated user for all requests in this test
  app.addHook('onRequest', async (request) => {
    request.authUser = { id: 'test-user-billing-001', tier: 'free' };
  });

  await app.register(billingRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Tests: GET /api/v1/billing/plans ─────────────────────────────────────────

describe('GET /api/v1/billing/plans', () => {
  it('returns 200 with an array of plans', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('includes free plan with correct fields', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    const plans = response.json() as Array<Record<string, unknown>>;
    const freePlan = plans.find((p) => p['tier'] === 'free');
    expect(freePlan).toBeDefined();
    expect(freePlan?.['maxExportsPerMonth']).toBe(5);
    expect(freePlan?.['includeAiSummary']).toBe(false);
    expect(freePlan?.['pricePerMonth']).toBe(0);
  });

  it('includes paid plan with correct fields', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    const plans = response.json() as Array<Record<string, unknown>>;
    const paidPlan = plans.find((p) => p['tier'] === 'paid');
    expect(paidPlan).toBeDefined();
    expect(paidPlan?.['maxExportsPerMonth']).toBe(100);
    expect(paidPlan?.['includeAiSummary']).toBe(true);
    expect(paidPlan?.['pricePerMonth']).toBe(500);
  });

  it('returns JSON content type', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── Tests: GET /api/v1/billing/usage ─────────────────────────────────────────

describe('GET /api/v1/billing/usage', () => {
  it('returns 200 with usage record for authenticated user', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/usage' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body['userId']).toBe('test-user-billing-001');
    expect(typeof body['period']).toBe('string');
    expect(typeof body['exportCount']).toBe('number');
    expect(typeof body['aiSummaryCount']).toBe('number');
  });

  it('returns period in YYYY-MM format', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/usage' });
    const body = response.json() as Record<string, unknown>;
    expect(body['period']).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns zero counts for fresh user', async () => {
    // Use a fresh app with a different user ID to avoid pollution from other tests
    const freshApp = Fastify({ logger: false });
    freshApp.decorateRequest('authUser', null);
    freshApp.addHook('onRequest', async (request) => {
      request.authUser = { id: 'fresh-user-zero-counts', tier: 'free' };
    });
    await freshApp.register(billingRoutes);
    await freshApp.ready();

    const response = await freshApp.inject({ method: 'GET', url: '/api/v1/billing/usage' });
    const body = response.json() as Record<string, unknown>;
    expect(body['exportCount']).toBe(0);
    expect(body['aiSummaryCount']).toBe(0);
    expect(body['totalCostCents']).toBe(0);

    await freshApp.close();
  });
});
