/**
 * JSON Schema definitions cho webhook routes.
 * Plain objects (no TypeBox) — consistent với các schema khác trong project.
 */

const VALID_EVENT_TYPES = ['export.completed', 'export.failed', 'summary.completed'] as const;

/** Schema cho POST /api/v1/webhooks/subscribe body */
export const subscribeWebhookBodySchema = {
  type: 'object',
  required: ['url', 'events'],
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      minLength: 1,
      maxLength: 2048,
    },
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
        enum: VALID_EVENT_TYPES,
      },
      uniqueItems: true,
    },
  },
  additionalProperties: false,
} as const;

/** Response schema cho subscribe — bao gồm secret (one-time) */
const subscribeResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    url: { type: 'string' },
    events: {
      type: 'array',
      items: { type: 'string' },
    },
    secret: { type: 'string', description: 'HMAC signing secret — shown only once' },
    created_at: { type: 'string' },
  },
} as const;

/** Response schema cho list — secret không bao giờ trả về sau lần đầu */
const listItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    url: { type: 'string' },
    events: {
      type: 'array',
      items: { type: 'string' },
    },
    created_at: { type: 'string' },
    active: { type: 'boolean' },
  },
} as const;

/** Schema params cho DELETE /api/v1/webhooks/:id */
const webhookIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

/** Full route schema cho POST subscribe */
export const postWebhookSubscribeSchema = {
  body: subscribeWebhookBodySchema,
  response: {
    201: subscribeResponseSchema,
  },
} as const;

/** Full route schema cho GET list */
export const getWebhookListSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        subscriptions: {
          type: 'array',
          items: listItemSchema,
        },
      },
    },
  },
} as const;

/** Full route schema cho DELETE */
export const deleteWebhookSchema = {
  params: webhookIdParamsSchema,
  response: {
    204: { type: 'null' },
  },
} as const;
