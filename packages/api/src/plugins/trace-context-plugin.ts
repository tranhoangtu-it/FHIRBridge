/**
 * W3C Trace Context plugin (H-18).
 *
 * Accepts `traceparent` + optional `tracestate` headers, validates the traceparent format,
 * and exposes parsed trace + span IDs on the request (request.trace). When absent or invalid,
 * synthesizes a fresh traceparent so downstream logs/responses always carry one.
 *
 * Also echoes traceparent on the response, making end-to-end correlation trivial.
 *
 * traceparent format: `version-traceId-parentId-flags`
 *   version:  2 hex
 *   traceId:  32 hex (not all zero)
 *   parentId: 16 hex (not all zero)
 *   flags:    2 hex
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'node:crypto';

import { skipOverride } from './plugin-utils.js';

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const ZERO_TRACE = '00000000000000000000000000000000';
const ZERO_SPAN = '0000000000000000';

export interface TraceContext {
  traceId: string;
  parentId: string;
  spanId: string;
  flags: string;
  version: string;
  tracestate?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    trace?: TraceContext;
  }
}

function parse(traceparent: string): TraceContext | null {
  const match = TRACEPARENT_RE.exec(traceparent);
  if (!match) return null;
  const [, version, traceId, parentId, flags] = match;
  if (!version || !traceId || !parentId || !flags) return null;
  if (traceId === ZERO_TRACE || parentId === ZERO_SPAN) return null;
  return { version, traceId, parentId, spanId: '', flags };
}

function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

function newSpanId(): string {
  return randomBytes(8).toString('hex');
}

function toHeader(ctx: TraceContext): string {
  return `${ctx.version}-${ctx.traceId}-${ctx.spanId}-${ctx.flags}`;
}

async function _traceContextPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incoming = request.headers['traceparent'];
    const tracestate = request.headers['tracestate'];

    let ctx: TraceContext;
    if (typeof incoming === 'string') {
      const parsed = parse(incoming);
      if (parsed) {
        ctx = {
          version: parsed.version,
          traceId: parsed.traceId,
          parentId: parsed.parentId,
          spanId: newSpanId(),
          flags: parsed.flags,
        };
      } else {
        ctx = {
          version: '00',
          traceId: newTraceId(),
          parentId: ZERO_SPAN,
          spanId: newSpanId(),
          flags: '01',
        };
      }
    } else {
      ctx = {
        version: '00',
        traceId: newTraceId(),
        parentId: ZERO_SPAN,
        spanId: newSpanId(),
        flags: '01',
      };
    }

    if (typeof tracestate === 'string' && tracestate.length > 0) {
      ctx.tracestate = tracestate;
    }

    request.trace = ctx;
    reply.header('traceparent', toHeader(ctx));
    if (ctx.tracestate) {
      reply.header('tracestate', ctx.tracestate);
    }
  });
}

export const traceContextPlugin = skipOverride(_traceContextPlugin);
