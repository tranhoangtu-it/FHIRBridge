/**
 * Tests for connector-schemas.ts — validates JSON Schema correctness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { postConnectorTestSchema, connectorTestRequestSchema } from '../connector-schemas.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.post('/connector/test', { schema: postConnectorTestSchema }, async (req) => req.body);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('connectorTestRequestSchema — valid payload', () => {
  it('accepts minimal valid connector test payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'https://fhir.example.com' },
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts payload with optional fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: {
        type: 'fhir-endpoint',
        config: {
          baseUrl: 'https://fhir.example.com',
          clientId: 'my-client',
          clientSecret: 'secret',
          tokenEndpoint: 'https://auth.example.com/token',
          timeout: 5000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('connectorTestRequestSchema — invalid payload', () => {
  it('rejects when type is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: { config: { baseUrl: 'https://fhir.example.com' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when config is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: { type: 'fhir-endpoint' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when config.baseUrl is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: { type: 'fhir-endpoint', config: { clientId: 'abc' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid type enum value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: {
        type: 'unknown-type',
        config: { baseUrl: 'https://fhir.example.com' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty baseUrl (minLength: 1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: '' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('strips additional top-level properties (Fastify removeAdditional mode)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connector/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'https://fhir.example.com' },
        extraField: 'oops',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('extraField');
  });
});

describe('connectorTestRequestSchema — plain object shape', () => {
  it('has required fields type and config', () => {
    expect(connectorTestRequestSchema.required).toContain('type');
    expect(connectorTestRequestSchema.required).toContain('config');
  });

  it('type only allows fhir-endpoint', () => {
    expect(connectorTestRequestSchema.properties.type.enum).toContain('fhir-endpoint');
    expect(connectorTestRequestSchema.properties.type.enum.length).toBe(1);
  });
});
