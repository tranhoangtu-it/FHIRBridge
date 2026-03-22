/**
 * Tests for POST /api/v1/connectors/test
 * Uses Fastify inject() — no real network connections.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { connectorRoutes } from '../connector-routes.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(connectorRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/connectors/test', () => {
  it('returns a connection status object', async () => {
    // Uses an external domain — the connector will fail to connect but return a status object
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'https://hapi.fhir.org/baseR4', authType: 'none' },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // Either connected or failed — both produce a valid status object
    expect(typeof body.connected).toBe('boolean');
    expect(body.checkedAt).toBeDefined();
  });

  it('returns connected: false with error message for SSRF-blocked localhost', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'http://localhost:8080/fhir', authType: 'none' },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/Internal endpoints are not allowed/i);
  });

  it('blocks private 192.168 IP (SSRF)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      payload: {
        type: 'fhir-endpoint',
        config: { baseUrl: 'http://192.168.0.1/fhir', authType: 'none' },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/Private IP ranges are not allowed/i);
  });

  it('returns 400 for invalid request body (missing type)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/connectors/test',
      payload: { config: { baseUrl: 'https://example.com/fhir' } },
    });
    // Fastify schema validation returns 400
    expect(response.statusCode).toBe(400);
  });
});
