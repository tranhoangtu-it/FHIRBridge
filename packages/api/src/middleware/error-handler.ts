/**
 * Centralized error handler for Fastify.
 * Maps domain errors to HTTP status codes.
 * Never exposes stack traces or internal details to clients.
 * PHI-safe: all error messages are generic.
 *
 * H-10: Structured error codes. Response shape:
 *   { statusCode, error, code, message, docs_url, requestId }
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ConnectorError } from '@fhirbridge/core';

/** Optional docs base URL for deep links. Override via ERROR_DOCS_BASE_URL env. */
const DOCS_BASE_URL = process.env['ERROR_DOCS_BASE_URL'] ?? 'https://docs.fhirbridge.io/errors';

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
  if (name === 'ConflictError') return 409;
  if (name === 'RateLimitError') return 429;

  if (error instanceof ConnectorError) {
    if (error.code === 'AUTH_FAILED') return 401;
    if (error.code === 'NOT_FOUND') return 404;
    return 502; // upstream connector failure
  }

  return 500;
}

/** Stable machine-readable code per HTTP status. Clients pin assertions on this. */
function resolveCode(error: FastifyError | Error, status: number): string {
  // Honor explicit .code property if present (e.g., ConnectorError)
  const raw = (error as FastifyError & { code?: string }).code;
  if (raw && typeof raw === 'string' && raw.length > 0) return raw;

  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502) return 'UPSTREAM_UNAVAILABLE';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
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
    const code = resolveCode(error, status);
    const message = safeMessage(error, status);

    request.log.error(
      { err: error, requestId: (request as FastifyRequest & { id?: string }).id, code },
      'Request error',
    );

    reply.status(status).send({
      statusCode: status,
      error: error.name ?? 'Error',
      code,
      message,
      docs_url: `${DOCS_BASE_URL}/${code.toLowerCase()}`,
      requestId: (request as FastifyRequest & { id?: string }).id,
    });
  });
}
