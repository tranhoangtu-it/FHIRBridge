/**
 * Tests for billing-schemas.ts — validates JSON Schema correctness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  postBillingSubscribeSchema,
  postSubscribeBodySchema,
  getUsageResponseSchema,
  getPlansResponseSchema,
} from '../billing-schemas.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Subscribe route — validates body
  app.post('/billing/subscribe', { schema: postBillingSubscribeSchema }, async (req) => req.body);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('postSubscribeBodySchema — valid payload', () => {
  it('accepts stripe as provider', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/subscribe',
      payload: { provider: 'stripe' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts sepay as provider', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/subscribe',
      payload: { provider: 'sepay' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('postSubscribeBodySchema — invalid payload', () => {
  it('rejects when provider is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/subscribe',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid provider enum value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/subscribe',
      payload: { provider: 'paypal' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('strips additional properties (Fastify removeAdditional mode)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/subscribe',
      payload: { provider: 'stripe', extra: 'field' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('extra');
  });
});

describe('billing schemas — plain object shapes', () => {
  it('postSubscribeBodySchema has required provider field', () => {
    expect(postSubscribeBodySchema.required).toContain('provider');
    expect(postSubscribeBodySchema.properties.provider.enum).toContain('stripe');
    expect(postSubscribeBodySchema.properties.provider.enum).toContain('sepay');
  });

  it('getUsageResponseSchema defines correct property types', () => {
    const props = getUsageResponseSchema.properties;
    expect(props.exportCount.type).toBe('number');
    expect(props.aiSummaryCount.type).toBe('number');
    expect(props.totalCostCents.type).toBe('number');
    expect(props.userId.type).toBe('string');
    expect(props.period.type).toBe('string');
  });

  it('getPlansResponseSchema is an array schema', () => {
    expect(getPlansResponseSchema.type).toBe('array');
    const itemProps = getPlansResponseSchema.items.properties;
    expect(itemProps.tier.enum).toContain('free');
    expect(itemProps.tier.enum).toContain('paid');
    expect(itemProps.maxExportsPerMonth.type).toBe('number');
    expect(itemProps.includeAiSummary.type).toBe('boolean');
  });
});
