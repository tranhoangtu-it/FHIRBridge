/**
 * Tests for trace-context-plugin (H-18).
 * Validates W3C Trace Context parse/propagate/synthesize behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { traceContextPlugin } from '../trace-context-plugin.js';

let app: FastifyInstance;

const VALID = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
const INVALID_SHAPE = '00-0af7651916cd43dd8448eb211c80319c';
const ALL_ZERO_TRACE = '00-00000000000000000000000000000000-b7ad6b7169203331-01';
const ALL_ZERO_PARENT = '00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01';

beforeEach(async () => {
  app = Fastify({ logger: false });
  await app.register(traceContextPlugin);

  app.get('/trace', async (request) => ({
    traceId: request.trace?.traceId,
    parentId: request.trace?.parentId,
    spanId: request.trace?.spanId,
    flags: request.trace?.flags,
    tracestate: request.trace?.tracestate,
  }));

  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('Trace Context plugin', () => {
  it('parses valid traceparent, preserves traceId, assigns new spanId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trace',
      headers: { traceparent: VALID, tracestate: 'vendor=abc' },
    });
    const body = res.json();
    expect(body.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
    expect(body.parentId).toBe('b7ad6b7169203331');
    expect(body.spanId).toHaveLength(16);
    expect(body.spanId).not.toBe('b7ad6b7169203331');
    expect(body.flags).toBe('01');
    expect(body.tracestate).toBe('vendor=abc');
    expect(res.headers['traceparent']).toBe(
      `00-0af7651916cd43dd8448eb211c80319c-${body.spanId}-01`,
    );
    expect(res.headers['tracestate']).toBe('vendor=abc');
  });

  it('synthesizes traceparent when header missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/trace' });
    const body = res.json();
    expect(body.traceId).toHaveLength(32);
    expect(body.spanId).toHaveLength(16);
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('rejects malformed traceparent, generates fresh trace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trace',
      headers: { traceparent: INVALID_SHAPE },
    });
    const body = res.json();
    expect(body.traceId).toHaveLength(32);
    expect(body.traceId).not.toBe('0af7651916cd43dd8448eb211c80319c');
  });

  it('rejects all-zero traceId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trace',
      headers: { traceparent: ALL_ZERO_TRACE },
    });
    const body = res.json();
    expect(body.traceId).not.toBe('00000000000000000000000000000000');
  });

  it('rejects all-zero parentId → synthesize fresh trace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trace',
      headers: { traceparent: ALL_ZERO_PARENT },
    });
    const body = res.json();
    // Input trace rejected — new traceId generated
    expect(body.traceId).not.toBe('0af7651916cd43dd8448eb211c80319c');
    expect(body.traceId).toHaveLength(32);
  });

  it('tracestate only forwarded when present', async () => {
    const res = await app.inject({ method: 'GET', url: '/trace' });
    expect(res.json().tracestate).toBeUndefined();
    expect(res.headers['tracestate']).toBeUndefined();
  });
});
