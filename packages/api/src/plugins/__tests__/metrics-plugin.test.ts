/**
 * Tests for metrics-plugin (FR-O3).
 * Verifies Prometheus text format + counters + histogram + bearer token gate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { metricsPlugin, MetricsRegistry } from '../metrics-plugin.js';

let app: FastifyInstance;
let registry: MetricsRegistry;

beforeEach(async () => {
  app = Fastify({ logger: false });
  registry = new MetricsRegistry();
  await app.register(metricsPlugin, { registry });

  app.get('/ping', async () => ({ ok: true }));
  app.get('/boom', async (_req, reply) => reply.status(500).send({ error: 'boom' }));

  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('Metrics plugin', () => {
  it('records request count by method/route/status', async () => {
    await app.inject({ method: 'GET', url: '/ping' });
    await app.inject({ method: 'GET', url: '/ping' });
    await app.inject({ method: 'GET', url: '/boom' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    const body = res.body;
    expect(body).toContain(
      'fhirbridge_http_requests_total{method="GET",route="/ping",status="200"} 2',
    );
    expect(body).toContain(
      'fhirbridge_http_requests_total{method="GET",route="/boom",status="500"} 1',
    );
  });

  it('/metrics itself does not appear in request count', async () => {
    await app.inject({ method: 'GET', url: '/metrics' });
    await app.inject({ method: 'GET', url: '/metrics' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).not.toContain('route="/metrics"');
  });

  it('emits histogram buckets + count + sum', async () => {
    await app.inject({ method: 'GET', url: '/ping' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;
    expect(body).toContain(
      'fhirbridge_http_request_duration_ms_bucket{method="GET",route="/ping",le="5"}',
    );
    expect(body).toContain(
      'fhirbridge_http_request_duration_ms_bucket{method="GET",route="/ping",le="+Inf"} 1',
    );
    expect(body).toContain(
      'fhirbridge_http_request_duration_ms_count{method="GET",route="/ping"} 1',
    );
    expect(body).toContain('fhirbridge_http_request_duration_ms_sum{method="GET",route="/ping"}');
  });

  it('exposes quota + export error counters', async () => {
    registry.recordQuotaDenial();
    registry.recordQuotaDenial();
    registry.recordExportError('ssrf_blocked');
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toContain('fhirbridge_quota_denials_total 2');
    expect(res.body).toContain('fhirbridge_export_errors_total{reason="ssrf_blocked"} 1');
  });

  it('sanitizes export error reason labels', async () => {
    registry.recordExportError('path with spaces & symbols!');
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toMatch(
      /fhirbridge_export_errors_total\{reason="path_with_spaces___symbols_"\}/,
    );
  });

  it('bearer token gate rejects missing/wrong token', async () => {
    const protectedApp = Fastify({ logger: false });
    await protectedApp.register(metricsPlugin, { bearerToken: 'secret-token-xxxx' });
    await protectedApp.ready();

    const no = await protectedApp.inject({ method: 'GET', url: '/metrics' });
    expect(no.statusCode).toBe(401);

    const wrong = await protectedApp.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await protectedApp.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer secret-token-xxxx' },
    });
    expect(ok.statusCode).toBe(200);
    await protectedApp.close();
  });

  it('decorates fastify.metrics for service-layer recording', () => {
    expect(app.metrics).toBe(registry);
  });
});
