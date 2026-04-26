/**
 * Tests for auth plugin — JWT + API key authentication.
 * Uses Fastify inject() — no network.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { authPlugin } from '../auth-plugin.js';
import type { ApiConfig } from '../../config.js';

const JWT_SECRET = 'test-super-secret-for-unit-tests';
const VALID_API_KEY = 'valid-test-api-key-123';

const mockConfig: ApiConfig = {
  port: 3001,
  host: '0.0.0.0',
  jwtSecret: JWT_SECRET,
  hmacSecret: JWT_SECRET,
  apiKeys: [VALID_API_KEY],
  corsOrigins: ['http://localhost:3000'],
  logLevel: 'silent',
};

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(authPlugin, { config: mockConfig });

  // Protected test route
  app.get('/api/v1/protected', async (req, reply) => {
    return reply.send({ user: req.authUser });
  });

  // Simulated health route (public)
  app.get('/api/v1/health', async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Auth plugin — API key', () => {
  it('allows requests with valid API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/protected',
      headers: { 'X-API-Key': VALID_API_KEY },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toMatch(/^apikey:[0-9a-f]{16}$/);
  });

  it('rejects requests with invalid API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/protected',
      headers: { 'X-API-Key': 'wrong-key' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('Auth plugin — JWT', () => {
  it('allows requests with valid JWT', async () => {
    const token = app.jwt.sign({ sub: 'user-123' });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/protected',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe('user-123');
  });

  it('rejects requests with invalid JWT', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/protected',
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('Auth plugin — public routes', () => {
  it('allows health endpoint without auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
  });
});

describe('Auth plugin — missing auth', () => {
  it('returns 401 for requests without any credentials', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/protected' });
    expect(response.statusCode).toBe(401);
  });
});
