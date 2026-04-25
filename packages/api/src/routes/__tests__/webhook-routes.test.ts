/**
 * Tests cho webhook routes:
 *   POST   /api/v1/webhooks/subscribe
 *   GET    /api/v1/webhooks/list
 *   DELETE /api/v1/webhooks/:id
 *
 * Dùng Fastify inject() với real WebhookSubscriptionStore (in-memory).
 * SSRF validation dùng @fhirbridge/core — test real validation path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AuthUser } from '../../plugins/auth-plugin.js';
import { WebhookSubscriptionStore } from '../../services/webhook-subscription-store.js';
import { webhookRoutes } from '../webhook-routes.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildApp(
  store: WebhookSubscriptionStore,
  user: AuthUser | null = { id: 'user-1', tier: 'paid' },
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('authUser', null);
  app.addHook('onRequest', async (request) => {
    (request as unknown as { authUser: AuthUser | null }).authUser = user;
  });
  return app
    .register(webhookRoutes, { subscriptionStore: store })
    .ready()
    .then(() => app);
}

// ── POST /api/v1/webhooks/subscribe ───────────────────────────────────────

describe('POST /api/v1/webhooks/subscribe', () => {
  let app: FastifyInstance;
  let store: WebhookSubscriptionStore;

  beforeEach(async () => {
    store = new WebhookSubscriptionStore();
    app = await buildApp(store);
  });

  afterEach(async () => {
    await app.close();
  });

  it('trả 201 với id, url, events, secret, created_at', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'https://example.com/webhook',
        events: ['export.completed'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      id: string;
      url: string;
      events: string[];
      secret: string;
      created_at: string;
    }>();
    expect(body.id).toMatch(/^sub_/);
    expect(body.url).toBe('https://example.com/webhook');
    expect(body.events).toContain('export.completed');
    // Secret phải là 64-char hex (32 bytes)
    expect(body.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(body.created_at).toBeTruthy();
  });

  it('lưu subscription vào store', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'https://example.com/webhook',
        events: ['export.completed'],
      },
    });

    const subs = store.findByUserId('user-1');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.url).toBe('https://example.com/webhook');
  });

  it('hỗ trợ nhiều event types', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'https://example.com/webhook',
        events: ['export.completed', 'export.failed', 'summary.completed'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ events: string[] }>();
    expect(body.events).toHaveLength(3);
  });

  it('trả 400 khi URL là private IP (SSRF rejection)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'http://192.168.1.1/hook',
        events: ['export.completed'],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ message: string }>();
    expect(body.message).toMatch(/Invalid webhook URL/);
  });

  it('trả 400 khi URL là metadata endpoint (SSRF rejection)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'http://169.254.169.254/latest/meta-data',
        events: ['export.completed'],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('trả 400 khi thiếu events', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: { url: 'https://example.com/webhook' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('trả 400 khi events là event type không hợp lệ', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('trả 400 khi thiếu url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: { events: ['export.completed'] },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── GET /api/v1/webhooks/list ──────────────────────────────────────────────

describe('GET /api/v1/webhooks/list', () => {
  let app: FastifyInstance;
  let store: WebhookSubscriptionStore;

  beforeEach(async () => {
    store = new WebhookSubscriptionStore();
    app = await buildApp(store);
  });

  afterEach(async () => {
    await app.close();
  });

  it('trả [] khi chưa có subscription', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks/list' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ subscriptions: unknown[] }>();
    expect(body.subscriptions).toEqual([]);
  });

  it('trả list subscriptions của user hiện tại', async () => {
    store.create('user-1', 'https://a.com/hook', ['export.completed']);
    store.create('user-1', 'https://b.com/hook', ['export.failed']);

    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks/list' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ subscriptions: Array<{ url: string }> }>();
    expect(body.subscriptions).toHaveLength(2);
  });

  it('secret KHÔNG có trong list response', async () => {
    store.create('user-1', 'https://a.com/hook', ['export.completed']);

    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks/list' });

    const body = res.json<{ subscriptions: Array<Record<string, unknown>> }>();
    expect(body.subscriptions[0]).not.toHaveProperty('secret');
  });

  it('owner isolation: chỉ thấy subscription của chính mình', async () => {
    // user-1 sub
    store.create('user-1', 'https://a.com/hook', ['export.completed']);
    // user-2 sub — không được thấy
    store.create('user-2', 'https://evil.com/hook', ['export.completed']);

    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks/list' });

    const body = res.json<{ subscriptions: Array<{ url: string }> }>();
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]!.url).toBe('https://a.com/hook');
  });

  it('trả id, url, events, created_at, active trong mỗi item', async () => {
    store.create('user-1', 'https://a.com/hook', ['export.completed']);

    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks/list' });

    const body = res.json<{
      subscriptions: Array<{
        id: string;
        url: string;
        events: string[];
        created_at: string;
        active: boolean;
      }>;
    }>();
    const sub = body.subscriptions[0]!;
    expect(sub.id).toMatch(/^sub_/);
    expect(sub.url).toBe('https://a.com/hook');
    expect(sub.events).toContain('export.completed');
    expect(sub.created_at).toBeTruthy();
    expect(sub.active).toBe(true);
  });
});

// ── DELETE /api/v1/webhooks/:id ────────────────────────────────────────────

describe('DELETE /api/v1/webhooks/:id', () => {
  let app: FastifyInstance;
  let store: WebhookSubscriptionStore;

  beforeEach(async () => {
    store = new WebhookSubscriptionStore();
    app = await buildApp(store);
  });

  afterEach(async () => {
    await app.close();
  });

  it('trả 204 khi xóa thành công', async () => {
    const sub = store.create('user-1', 'https://a.com/hook', ['export.completed']);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/webhooks/${sub.id}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it('xóa subscription khỏi store', async () => {
    const sub = store.create('user-1', 'https://a.com/hook', ['export.completed']);

    await app.inject({ method: 'DELETE', url: `/api/v1/webhooks/${sub.id}` });

    expect(store.findById(sub.id)).toBeUndefined();
  });

  it('trả 404 khi id không tồn tại', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/webhooks/sub_nonexistent',
    });

    expect(res.statusCode).toBe(404);
  });

  it('trả 404 khi user không phải owner (không lộ 403)', async () => {
    // Tạo sub với user-2
    const sub = store.create('user-2', 'https://a.com/hook', ['export.completed']);

    // user-1 cố xóa → 404 (không phân biệt not-found vs not-owner)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/webhooks/${sub.id}`,
    });

    expect(res.statusCode).toBe(404);
    // Sub của user-2 vẫn còn
    expect(store.findById(sub.id)).toBeDefined();
  });
});

// ── Auth check ─────────────────────────────────────────────────────────────

describe('Webhook routes — unauthenticated user', () => {
  let app: FastifyInstance;
  let store: WebhookSubscriptionStore;

  beforeEach(async () => {
    store = new WebhookSubscriptionStore();
    // user = null → authUser sẽ là undefined
    app = await buildApp(store, null);
  });

  afterEach(async () => {
    await app.close();
  });

  it('subscribe dùng anonymous userId khi không có authUser', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/subscribe',
      payload: {
        url: 'https://example.com/webhook',
        events: ['export.completed'],
      },
    });
    // Vẫn hoạt động — auth enforcement là responsibility của authPlugin (tested separately)
    // Route tự fallback về 'anonymous' userId
    expect(res.statusCode).toBe(201);
    const subs = store.findByUserId('anonymous');
    expect(subs).toHaveLength(1);
  });
});
