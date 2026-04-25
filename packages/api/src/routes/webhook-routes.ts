/**
 * Webhook routes:
 *   POST   /api/v1/webhooks/subscribe — đăng ký webhook URL
 *   GET    /api/v1/webhooks/list      — liệt kê subscriptions của user
 *   DELETE /api/v1/webhooks/:id       — xóa subscription
 *
 * Auth required cho tất cả routes (không có PUBLIC_PATHS exception).
 * SSRF validation trước khi lưu URL.
 * Secret chỉ trả về 1 lần khi subscribe — không có endpoint lấy lại.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateBaseUrl } from '@fhirbridge/core';
import type { WebhookSubscriptionStore } from '../services/webhook-subscription-store.js';
import type { WebhookEventType } from '../services/webhook-subscription-store.js';
import {
  postWebhookSubscribeSchema,
  getWebhookListSchema,
  deleteWebhookSchema,
} from '../schemas/webhook-schemas.js';

interface SubscribeBody {
  url: string;
  events: WebhookEventType[];
}

interface WebhookIdParams {
  id: string;
}

export interface WebhookRoutesOpts {
  subscriptionStore: WebhookSubscriptionStore;
}

export async function webhookRoutes(
  fastify: FastifyInstance,
  opts: WebhookRoutesOpts,
): Promise<void> {
  const { subscriptionStore } = opts;

  // POST /api/v1/webhooks/subscribe
  fastify.post<{ Body: SubscribeBody }>(
    '/api/v1/webhooks/subscribe',
    { schema: postWebhookSubscribeSchema },
    async (request: FastifyRequest<{ Body: SubscribeBody }>, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';
      const { url, events } = request.body;

      // SSRF validation — phải pass trước khi lưu URL vào store
      const ssrfResult = validateBaseUrl(url);
      if (!ssrfResult.ok) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid webhook URL: ${ssrfResult.reason}`,
        });
      }

      const result = subscriptionStore.create(userId, url, events);

      return reply.status(201).send({
        id: result.id,
        url: result.url,
        events: result.events,
        secret: result.secret,
        created_at: result.createdAt,
      });
    },
  );

  // GET /api/v1/webhooks/list
  fastify.get(
    '/api/v1/webhooks/list',
    { schema: getWebhookListSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';
      const subs = subscriptionStore.findByUserId(userId);

      // Secret không bao giờ trả về sau lần tạo đầu tiên
      const subscriptions = subs.map((s) => ({
        id: s.id,
        url: s.url,
        events: s.events,
        created_at: s.createdAt,
        active: s.active,
      }));

      return reply.send({ subscriptions });
    },
  );

  // DELETE /api/v1/webhooks/:id
  fastify.delete<{ Params: WebhookIdParams }>(
    '/api/v1/webhooks/:id',
    { schema: deleteWebhookSchema },
    async (request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';
      const { id } = request.params;

      // delete() tự kiểm tra ownership — trả false khi not-found hoặc not-owner
      // Không phân biệt 404 vs 403 để tránh enumeration attack
      const deleted = subscriptionStore.delete(id, userId);
      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Webhook subscription not found',
        });
      }

      return reply.status(204).send();
    },
  );
}
