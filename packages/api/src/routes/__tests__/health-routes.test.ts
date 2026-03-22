/**
 * Tests for GET /api/v1/health
 * Uses Fastify inject() — no network needed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from '../health-routes.js';
import type { ApiConfig } from '../../config.js';

const mockConfig: ApiConfig = {
  port: 3001,
  host: '0.0.0.0',
  jwtSecret: 'test-secret',
  hmacSecret: 'test-hmac-secret',
  apiKeys: ['test-api-key'],
  corsOrigins: ['http://localhost:3000'],
  databaseUrl: 'postgres://localhost/test',
  redisUrl: 'redis://localhost:6379',
  logLevel: 'silent',
};

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(healthRoutes, { config: mockConfig });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/health', () => {
  it('returns 200 with ok status when db and redis configured', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body.timestamp).toBeDefined();
    expect(body.checks).toMatchObject({ server: 'ok', database: 'ok', redis: 'ok' });
  });

  it('returns degraded when db is not configured', async () => {
    const app2 = Fastify({ logger: false });
    const degradedConfig: ApiConfig = { ...mockConfig, databaseUrl: undefined };
    await app2.register(healthRoutes, { config: degradedConfig });
    await app2.ready();

    const response = await app2.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('degraded');
    await app2.close();
  });

  it('returns JSON content type', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
