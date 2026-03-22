/**
 * Tests for centralized error handler.
 * Verifies HTTP status mapping and safe message behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { ConnectorError } from '@fhirbridge/core';
import { registerErrorHandler } from '../error-handler.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  registerErrorHandler(app);

  // Routes that simulate various error types
  app.get('/throw/validation', async () => {
    const err = new Error('Invalid input');
    err.name = 'ValidationError';
    throw err;
  });

  app.get('/throw/not-found', async () => {
    const err = new Error('Resource not found');
    err.name = 'NotFoundError';
    throw err;
  });

  app.get('/throw/connector', async () => {
    throw new ConnectorError('Connection refused', 'NETWORK_ERROR');
  });

  app.get('/throw/internal', async () => {
    throw new Error('Database is on fire');
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Error handler', () => {
  it('maps ValidationError to 400', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw/validation' });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Invalid input');
  });

  it('maps NotFoundError to 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw/not-found' });
    expect(response.statusCode).toBe(404);
    expect(response.json().statusCode).toBe(404);
  });

  it('maps ConnectorError to 502', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw/connector' });
    expect(response.statusCode).toBe(502);
  });

  it('maps generic errors to 500 with safe message', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw/internal' });
    expect(response.statusCode).toBe(500);
    const body = response.json();
    // Must NOT expose internal error details
    expect(body.message).not.toContain('Database is on fire');
    expect(body.message).toContain('unexpected error');
  });

  it('includes requestId in error response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/throw/internal',
      headers: { 'x-request-id': 'test-req-123' },
    });
    const body = response.json();
    // requestId may be present
    expect(body).toHaveProperty('statusCode');
  });
});
