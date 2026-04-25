/**
 * Prometheus /metrics plugin (FR-O3).
 *
 * In-memory counters + histograms — zero external dependencies, zero PHI.
 * Exposed on `GET /metrics` (text/plain; version=0.0.4 Prometheus format).
 *
 * Metrics:
 *   fhirbridge_http_requests_total{method,route,status}         Counter
 *   fhirbridge_http_request_duration_ms_bucket{method,route,le} Histogram
 *   fhirbridge_quota_denials_total                              Counter
 *   fhirbridge_export_errors_total{reason}                      Counter
 *
 * route is normalized from fastify.routerPath (template) so we don't explode cardinality
 * on path params. Unknown/404 routes collapse to "UNKNOWN".
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { skipOverride } from './plugin-utils.js';

const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

interface CounterKey {
  method: string;
  route: string;
  status: number;
}

interface HistogramKey {
  method: string;
  route: string;
}

export class MetricsRegistry {
  private readonly requestsTotal = new Map<string, number>();
  private readonly latencyBuckets = new Map<string, number[]>();
  private readonly latencyCount = new Map<string, number>();
  private readonly latencySum = new Map<string, number>();

  quotaDenialsTotal = 0;
  private readonly exportErrorsTotal = new Map<string, number>();

  private counterKey(k: CounterKey): string {
    return `${k.method}|${k.route}|${k.status}`;
  }

  private histKey(k: HistogramKey): string {
    return `${k.method}|${k.route}`;
  }

  recordRequest(method: string, route: string, status: number, durationMs: number): void {
    const ck = this.counterKey({ method, route, status });
    this.requestsTotal.set(ck, (this.requestsTotal.get(ck) ?? 0) + 1);

    const hk = this.histKey({ method, route });
    let buckets = this.latencyBuckets.get(hk);
    if (!buckets) {
      buckets = new Array(LATENCY_BUCKETS_MS.length).fill(0) as number[];
      this.latencyBuckets.set(hk, buckets);
    }
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i++) {
      if (durationMs <= (LATENCY_BUCKETS_MS[i] as number)) {
        buckets[i] = (buckets[i] as number) + 1;
      }
    }
    this.latencyCount.set(hk, (this.latencyCount.get(hk) ?? 0) + 1);
    this.latencySum.set(hk, (this.latencySum.get(hk) ?? 0) + durationMs);
  }

  recordQuotaDenial(): void {
    this.quotaDenialsTotal += 1;
  }

  recordExportError(reason: string): void {
    const safe = reason.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
    this.exportErrorsTotal.set(safe, (this.exportErrorsTotal.get(safe) ?? 0) + 1);
  }

  /** Render Prometheus 0.0.4 text format. */
  render(): string {
    const lines: string[] = [];

    lines.push('# HELP fhirbridge_http_requests_total Total HTTP requests.');
    lines.push('# TYPE fhirbridge_http_requests_total counter');
    for (const [key, value] of this.requestsTotal) {
      const [method, route, status] = key.split('|');
      lines.push(
        `fhirbridge_http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`,
      );
    }

    lines.push('# HELP fhirbridge_http_request_duration_ms Request latency in ms.');
    lines.push('# TYPE fhirbridge_http_request_duration_ms histogram');
    for (const [key, buckets] of this.latencyBuckets) {
      const [method, route] = key.split('|');
      for (let i = 0; i < LATENCY_BUCKETS_MS.length; i++) {
        lines.push(
          `fhirbridge_http_request_duration_ms_bucket{method="${method}",route="${route}",le="${LATENCY_BUCKETS_MS[i]}"} ${buckets[i]}`,
        );
      }
      lines.push(
        `fhirbridge_http_request_duration_ms_bucket{method="${method}",route="${route}",le="+Inf"} ${this.latencyCount.get(key) ?? 0}`,
      );
      lines.push(
        `fhirbridge_http_request_duration_ms_count{method="${method}",route="${route}"} ${this.latencyCount.get(key) ?? 0}`,
      );
      lines.push(
        `fhirbridge_http_request_duration_ms_sum{method="${method}",route="${route}"} ${this.latencySum.get(key) ?? 0}`,
      );
    }

    lines.push('# HELP fhirbridge_quota_denials_total Requests rejected by quota.');
    lines.push('# TYPE fhirbridge_quota_denials_total counter');
    lines.push(`fhirbridge_quota_denials_total ${this.quotaDenialsTotal}`);

    lines.push('# HELP fhirbridge_export_errors_total Export pipeline errors.');
    lines.push('# TYPE fhirbridge_export_errors_total counter');
    for (const [reason, value] of this.exportErrorsTotal) {
      lines.push(`fhirbridge_export_errors_total{reason="${reason}"} ${value}`);
    }

    return lines.join('\n') + '\n';
  }

  /** Test helper: reset everything. */
  reset(): void {
    this.requestsTotal.clear();
    this.latencyBuckets.clear();
    this.latencyCount.clear();
    this.latencySum.clear();
    this.exportErrorsTotal.clear();
    this.quotaDenialsTotal = 0;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsRegistry;
  }
}

export interface MetricsPluginOptions {
  registry?: MetricsRegistry;
  /** When true, expose /metrics endpoint. Default true. */
  exposeEndpoint?: boolean;
  /** Protect /metrics with a shared bearer token. When set, requests must match. */
  bearerToken?: string;
}

async function _metricsPlugin(
  fastify: FastifyInstance,
  opts: MetricsPluginOptions = {},
): Promise<void> {
  const registry = opts.registry ?? new MetricsRegistry();
  fastify.decorate('metrics', registry);

  const startTimes = new WeakMap<FastifyRequest, bigint>();

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    startTimes.set(request, process.hrtime.bigint());
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = startTimes.get(request);
    const durationMs = start ? Number(process.hrtime.bigint() - start) / 1_000_000 : 0;
    const route = request.routeOptions?.url ?? 'UNKNOWN';
    if (route === '/metrics') return;
    registry.recordRequest(request.method, route, reply.statusCode, durationMs);
  });

  if (opts.exposeEndpoint !== false) {
    fastify.get(
      '/metrics',
      { logLevel: 'warn' },
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (opts.bearerToken) {
          const auth = request.headers['authorization'];
          if (auth !== `Bearer ${opts.bearerToken}`) {
            return reply.status(401).send({ error: 'Unauthorized' });
          }
        }
        reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
        return registry.render();
      },
    );
  }
}

export const metricsPlugin = skipOverride(_metricsPlugin);
