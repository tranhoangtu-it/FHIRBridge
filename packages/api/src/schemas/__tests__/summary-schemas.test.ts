/**
 * Tests for summary-schemas.ts — validates JSON Schema correctness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  postSummaryGenerateSchema,
  getSummaryDownloadSchema,
  summaryGenerateRequestSchema,
} from '../summary-schemas.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  app.post('/summary/generate', { schema: postSummaryGenerateSchema }, async (req) => req.body);
  app.get('/summary/:id/download', { schema: getSummaryDownloadSchema }, async (req) => ({
    params: req.params,
    query: req.query,
  }));

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('summaryGenerateRequestSchema — valid payload', () => {
  it('accepts empty body (all fields optional)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts payload with bundle only', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: { bundle: { resourceType: 'Bundle', type: 'collection', entry: [] } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts full valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: {
        bundle: { resourceType: 'Bundle', type: 'collection', entry: [] },
        exportId: 'exp-123',
        summaryConfig: { language: 'en', provider: 'claude', detailLevel: 'standard' },
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts all valid language values', async () => {
    for (const lang of ['en', 'vi', 'ja']) {
      const res = await app.inject({
        method: 'POST',
        url: '/summary/generate',
        payload: { summaryConfig: { language: lang } },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('summaryGenerateRequestSchema — invalid payload', () => {
  it('strips additional top-level properties (Fastify removeAdditional mode)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: { unknownField: 'oops' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('unknownField');
  });

  it('rejects invalid language enum value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: { summaryConfig: { language: 'zh' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid provider enum value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/summary/generate',
      payload: { summaryConfig: { provider: 'gemini' } },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('getSummaryDownloadSchema — params validation', () => {
  it('accepts valid id param', async () => {
    const res = await app.inject({ method: 'GET', url: '/summary/abc-123/download' });
    expect(res.statusCode).toBe(200);
  });

  it('accepts format=composition querystring', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/summary/abc-123/download?format=composition',
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts format=markdown querystring', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/summary/abc-123/download?format=markdown',
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('summaryGenerateRequestSchema — plain object shape', () => {
  it('is an object schema with no required fields', () => {
    expect(summaryGenerateRequestSchema.type).toBe('object');
    expect((summaryGenerateRequestSchema as { required?: string[] }).required).toBeUndefined();
  });
});
