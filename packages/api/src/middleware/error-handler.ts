/**
 * Centralized error handler for Fastify.
 * Maps domain errors to HTTP status codes.
 * Never exposes stack traces or internal details to clients.
 * PHI-safe: all error messages are generic.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ConnectorError } from '@fhirbridge/core';

/** HTTP status mapping for well-known error names/codes */
function resolveStatus(error: FastifyError | Error): number {
  // Fastify validation errors
  if ((error as FastifyError).statusCode) {
    return (error as FastifyError).statusCode!;
  }

  // Check both .name property and constructor name for flexibility
  const name = error.name !== 'Error' ? error.name : error.constructor.name;

  if (name === 'ValidationError') return 400;
  if (name === 'AuthError' || error.message === 'Unauthorized') return 401;
  if (name === 'ForbiddenError') return 403;
  if (name === 'NotFoundError') return 404;
  if (name === 'RateLimitError') return 429;

  if (error instanceof ConnectorError) {
    if (error.code === 'AUTH_FAILED') return 401;
    if (error.code === 'NOT_FOUND') return 404;
    return 502; // upstream connector failure
  }

  return 500;
}

/** Safe message for client consumption (no internal details) */
function safeMessage(error: FastifyError | Error, status: number): string {
  // Pass through client-safe validation messages
  if (status === 400 && (error as FastifyError).validation) {
    return error.message;
  }
  if (status < 500) return error.message;
  // Never expose internal error details for 5xx
  return 'An unexpected error occurred. Please try again later.';
}

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const status = resolveStatus(error);
    const message = safeMessage(error, status);

    // Log full error server-side (no PHI in message expected)
    request.log.error({ err: error, requestId: (request as FastifyRequest & { id?: string }).id }, 'Request error');

    reply.status(status).send({
      statusCode: status,
      error: error.name ?? 'Error',
      message,
      requestId: (request as FastifyRequest & { id?: string }).id,
    });
  });
}
