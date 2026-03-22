/**
 * Rate limiter plugin — tier-aware sliding window rate limiting.
 * free tier: 10 requests/min, paid tier: 100 requests/min.
 * Uses Redis for distributed rate limiting when redisUrl is configured.
 */

import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { skipOverride } from './plugin-utils.js';

/** Rate limits per tier (requests per minute) */
const TIER_LIMITS: Record<string, number> = {
  free: 10,
  paid: 100,
};

interface RateLimiterOptions {
  redisUrl?: string;
}

async function _rateLimiterPlugin(
  fastify: FastifyInstance,
  opts: RateLimiterOptions,
): Promise<void> {
  let redisClient: Redis | undefined;

  if (opts.redisUrl) {
    try {
      redisClient = new Redis(opts.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      redisClient.on('error', (err: Error) => {
        fastify.log.warn(
          { err: err.message },
          '[RateLimiter] Redis error, falling back to in-memory',
        );
      });
      await redisClient.connect();
      fastify.log.info('[RateLimiter] connected to Redis for distributed rate limiting');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fastify.log.warn(`[RateLimiter] Redis connect failed (${msg}), using in-memory store`);
      redisClient = undefined;
    }
  }

  await fastify.register(fastifyRateLimit, {
    global: true,
    redis: redisClient,
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

  // Clean up Redis connection on server close
  if (redisClient) {
    const client = redisClient;
    fastify.addHook('onClose', async () => {
      await client.quit().catch(() => client.disconnect());
    });
  }
}

export const rateLimiterPlugin = skipOverride(_rateLimiterPlugin);
