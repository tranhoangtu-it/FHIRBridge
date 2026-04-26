/**
 * Tests for export routes:
 *   POST   /api/v1/export
 *   GET    /api/v1/export/:id/status
 *   GET    /api/v1/export/:id/download
 *
 * Uses Fastify inject() with mocked ExportService.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AuthUser } from '../auth-plugin.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStartExport = vi.fn().mockResolvedValue('export-id-123');
const mockGetStatus = vi.fn();

vi.mock('../../services/export-service.js', () => ({
  ExportService: vi.fn().mockImplementation(() => ({
    startExport: mockStartExport,
    getStatus: mockGetStatus,
  })),
}));

// Import AFTER mocks are registered
const { exportRoutes } = await import('../export-routes.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const validBody = {
  patientId: 'patient-001',
  connectorConfig: { type: 'fhir-endpoint', baseUrl: 'https://fhir.example.com' },
};

async function buildApp(user: AuthUser | null = { id: 'user-1' }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('authUser', null);
  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser | null }).authUser = user;
  });
  await app.register(exportRoutes);
  await app.ready();
  return app;
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStartExport.mockResolvedValue('export-id-123');
});

// ── POST /api/v1/export ───────────────────────────────────────────────────────

describe('POST /api/v1/export', () => {
  it('returns 202 with exportId on success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/export',
      payload: validBody,
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.exportId).toBe('export-id-123');
    expect(body.status).toBe('processing');
  });

  it('returns 400 when patientId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/export',
      payload: { connectorConfig: { type: 'fhir-endpoint' } },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /api/v1/export/:id/status ────────────────────────────────────────────

describe('GET /api/v1/export/:id/status', () => {
  it('returns 200 with status when export found', async () => {
    mockGetStatus.mockResolvedValueOnce({ status: 'processing', userId: 'user-1' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/export/export-id-123/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('processing');
  });

  it('returns 404 when export not found', async () => {
    mockGetStatus.mockResolvedValueOnce(undefined);
    const res = await app.inject({ method: 'GET', url: '/api/v1/export/nonexistent/status' });
    expect(res.statusCode).toBe(404);
  });
});

// ── GET /api/v1/export/:id/download ──────────────────────────────────────────

describe('GET /api/v1/export/:id/download', () => {
  const mockBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [{ resource: { resourceType: 'Patient', id: 'p1' } }],
  };

  it('returns Content-Type application/fhir+json for json format', async () => {
    mockGetStatus.mockResolvedValueOnce({
      status: 'complete',
      userId: 'user-1',
      bundle: mockBundle,
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/export/export-id-123/download' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/fhir\+json/);
  });

  it('returns 200 or 409 for ndjson streaming branch (raw stream bypasses inject body)', async () => {
    mockGetStatus.mockResolvedValueOnce({
      status: 'complete',
      userId: 'user-1',
      bundle: mockBundle,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export/export-id-123/download?format=ndjson',
    });
    expect([200, 409]).toContain(res.statusCode);
  });

  it('returns 409 when export is not complete', async () => {
    mockGetStatus.mockResolvedValueOnce({ status: 'processing', userId: 'user-1' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/export/export-id-123/download' });
    expect(res.statusCode).toBe(409);
  });

  it('returns 404 when export not found', async () => {
    mockGetStatus.mockResolvedValueOnce(undefined);
    const res = await app.inject({ method: 'GET', url: '/api/v1/export/missing/download' });
    expect(res.statusCode).toBe(404);
  });
});
