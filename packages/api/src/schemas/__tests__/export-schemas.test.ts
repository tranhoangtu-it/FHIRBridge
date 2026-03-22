/**
 * Tests for export-schemas.ts — validates JSON Schema correctness
 * using Fastify's built-in Ajv validator via a minimal route.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { exportRequestSchema, postExportSchema, getExportStatusSchema } from '../export-schemas.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Route that uses postExportSchema — validates body
  app.post('/export', { schema: postExportSchema }, async (req) => req.body);

  // Route that uses status params schema
  app.get('/export/:id/status', { schema: getExportStatusSchema }, async (req) => req.params);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('exportRequestSchema — required fields', () => {
  it('accepts valid export payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: {
        patientId: 'patient-001',
        connectorConfig: { type: 'fhir-endpoint', baseUrl: 'https://fhir.example.com' },
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects when patientId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: { connectorConfig: { type: 'fhir-endpoint' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when connectorConfig is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: { patientId: 'patient-001' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when connectorConfig.type is invalid enum value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: {
        patientId: 'patient-001',
        connectorConfig: { type: 'invalid-type' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty patientId (minLength: 1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: {
        patientId: '',
        connectorConfig: { type: 'csv' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid outputFormat enum values', async () => {
    for (const fmt of ['json', 'ndjson']) {
      const res = await app.inject({
        method: 'POST',
        url: '/export',
        payload: {
          patientId: 'p1',
          connectorConfig: { type: 'fhir-endpoint' },
          outputFormat: fmt,
        },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('strips additional properties (Fastify default removeAdditional mode)', async () => {
    // Fastify strips unknown fields rather than rejecting — additionalProperties:false
    // causes removal, not a 400 error.
    const res = await app.inject({
      method: 'POST',
      url: '/export',
      payload: {
        patientId: 'p1',
        connectorConfig: { type: 'fhir-endpoint' },
        unknownField: 'oops',
      },
    });
    expect(res.statusCode).toBe(200);
    // unknownField should be stripped from the echoed body
    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('unknownField');
  });
});

describe('exportRequestSchema — plain object shape', () => {
  it('is a plain object with type=object', () => {
    expect(exportRequestSchema.type).toBe('object');
    expect(exportRequestSchema.required).toContain('patientId');
    expect(exportRequestSchema.required).toContain('connectorConfig');
  });
});
