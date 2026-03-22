/**
 * Rate limiter plugin — tier-aware sliding window rate limiting.
 * free tier: 10 requests/min, paid tier: 100 requests/min.
 */

import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { skipOverride } from './plugin-utils.js';

/** Rate limits per tier (requests per minute) */
const TIER_LIMITS: Record<string, number> = {
  free: 10,
  paid: 100,
};

async function _rateLimiterPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: (req: FastifyRequest) => {
      const tier = req.authUser?.tier ?? 'free';
      return TIER_LIMITS[tier] ?? TIER_LIMITS['free']!;
    },
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => req.authUser?.id ?? req.ip,
    allowList: (req: FastifyRequest) => req.url.split('?')[0] === '/api/v1/health',
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
      requestId: (req as FastifyRequest & { id?: string }).id,
    }),
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}

export const rateLimiterPlugin = skipOverride(_rateLimiterPlugin);
