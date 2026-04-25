/**
 * Health check route — GET /api/v1/health
 * Reports server status, version, and real component connectivity.
 * No authentication required.
 *
 * Accepts opts.postgresAuditSink and opts.redisStore for live probes.
 * Falls back to config URL presence check when sinks are absent (test mode).
 */

import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
import type { ApiConfig } from '../config.js';
import type { PostgresAuditSink } from '../services/postgres-audit-sink.js';
import type { IRedisStore } from '../services/redis-store.js';

// Read version from package.json at import time (no hardcode)
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const API_VERSION: string = (_require('../../package.json') as { version: string }).version;

const healthSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        version: { type: 'string' },
        timestamp: { type: 'string' },
        checks: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface HealthRoutesOpts {
  config: ApiConfig;
  /** Optional live Postgres sink — probed via isHealthy() */
  postgresAuditSink?: PostgresAuditSink;
  /** Optional live Redis store — probed via isHealthy() */
  redisStore?: IRedisStore;
}

export async function healthRoutes(
  fastify: FastifyInstance,
  opts: HealthRoutesOpts,
): Promise<void> {
  fastify.get('/api/v1/health', { schema: healthSchema }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {
      server: 'ok',
    };

    // Database probe: prefer live sink health flag, fall back to URL presence
    if (opts.postgresAuditSink) {
      checks['database'] = opts.postgresAuditSink.isHealthy() ? 'ok' : 'error';
    } else {
      checks['database'] = opts.config.databaseUrl ? 'ok' : 'error';
    }

    // Redis probe: prefer live store health flag, fall back to URL presence
    if (opts.redisStore) {
      checks['redis'] = opts.redisStore.isHealthy() ? 'ok' : 'error';
    } else {
      checks['redis'] = opts.config.redisUrl ? 'ok' : 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return reply.status(200).send({
      status: allOk ? 'ok' : 'degraded',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
