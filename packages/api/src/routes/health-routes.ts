/**
 * Health check route — GET /api/v1/health
 * Reports server status, version, and component health.
 * No authentication required.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiConfig } from '../config.js';

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

export async function healthRoutes(fastify: FastifyInstance, opts: { config: ApiConfig }): Promise<void> {
  fastify.get('/api/v1/health', { schema: healthSchema }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {
      server: 'ok',
    };

    // Shallow DB/Redis connectivity check (no actual query — just flag presence)
    checks['database'] = opts.config.databaseUrl ? 'ok' : 'error';
    checks['redis'] = opts.config.redisUrl ? 'ok' : 'error';

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return reply.status(200).send({
      status: allOk ? 'ok' : 'degraded',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
