/**
 * CORS plugin — configures allowed origins from ApiConfig.
 * Registered early in plugin chain so all routes inherit CORS headers.
 */

import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import type { ApiConfig } from '../config.js';

import { skipOverride } from './plugin-utils.js';

async function _corsPlugin(fastify: FastifyInstance, opts: { config: ApiConfig }): Promise<void> {
  const origins = opts.config.corsOrigins;

  await fastify.register(fastifyCors, {
    origin: origins.length === 1 && origins[0] === '*' ? '*' : origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
    // Disable credentials when using wildcard origin (security: prevents any-origin auth requests)
    credentials: !(origins.length === 1 && origins[0] === '*'),
  });
}

export const corsPlugin = skipOverride(_corsPlugin);
