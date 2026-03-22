/**
 * Authentication plugin — verifies JWT Bearer tokens or X-API-Key header.
 * Skips auth for GET /api/v1/health.
 * Attaches user info to request via authUser property.
 *
 * skip-override ensures hooks and JWT decorators apply globally.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { ApiConfig, UserTier } from '../config.js';
import { skipOverride } from './plugin-utils.js';

export interface AuthUser {
  id: string;
  tier: UserTier;
}

// Augment FastifyRequest to carry typed user info
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/** Paths that bypass authentication */
const PUBLIC_PATHS = new Set(['/api/v1/health']);

async function _authPlugin(fastify: FastifyInstance, opts: { config: ApiConfig }): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: opts.config.jwtSecret,
    sign: { algorithm: 'HS256' },
  });

  const validApiKeys = new Set(opts.config.apiKeys);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] ?? '';
    if (PUBLIC_PATHS.has(path)) return;

    const apiKey = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;

    if (typeof apiKey === 'string' && apiKey) {
      if (!validApiKeys.has(apiKey)) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid API key' });
      }
      request.authUser = { id: `apikey:${apiKey.slice(0, 8)}`, tier: 'paid' };
      return;
    }

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await request.jwtVerify<{ sub?: string; id?: string; tier?: string }>();
        const id = decoded.sub ?? decoded.id ?? 'unknown';
        const tier: UserTier = decoded.tier === 'paid' ? 'paid' : 'free';
        request.authUser = { id, tier };
        return;
      } catch {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
      }
    }

    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
  });
}

export const authPlugin = skipOverride(_authPlugin);
