/**
 * Request ID plugin — ensures every request has a unique trace ID.
 * Reads X-Request-Id header or generates a UUID if missing.
 * Adds X-Request-Id to every response.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { skipOverride } from './plugin-utils.js';

async function _requestIdPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incomingId = request.headers['x-request-id'];
    const requestId = (typeof incomingId === 'string' ? incomingId : null) ?? randomUUID();
    Object.assign(request, { id: requestId });
    reply.header('X-Request-Id', requestId);
  });
}

export const requestIdPlugin = skipOverride(_requestIdPlugin);
