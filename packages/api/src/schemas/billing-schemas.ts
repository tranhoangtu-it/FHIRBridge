/**
 * JSON Schema definitions for billing routes.
 * Uses plain objects (no TypeBox) consistent with existing schema pattern.
 */

export const getUsageResponseSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    period: { type: 'string' },
    exportCount: { type: 'number' },
    aiSummaryCount: { type: 'number' },
    totalCostCents: { type: 'number' },
  },
} as const;

export const getPlansResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      tier: { type: 'string', enum: ['free', 'paid'] },
      maxExportsPerMonth: { type: 'number' },
      includeAiSummary: { type: 'boolean' },
      pricePerMonth: { type: 'number' },
    },
  },
} as const;

export const postSubscribeBodySchema = {
  type: 'object',
  required: ['provider'],
  properties: {
    provider: { type: 'string', enum: ['stripe', 'sepay'] },
  },
  additionalProperties: false,
} as const;

export const postSubscribeResponseSchema = {
  type: 'object',
  properties: {
    intentId: { type: 'string' },
    checkoutUrl: { type: 'string' },
    provider: { type: 'string' },
    status: { type: 'string' },
  },
} as const;

export const getBillingUsageSchema = {
  response: { 200: getUsageResponseSchema },
} as const;

export const getBillingPlansSchema = {
  response: { 200: getPlansResponseSchema },
} as const;

export const postBillingSubscribeSchema = {
  body: postSubscribeBodySchema,
  response: { 200: postSubscribeResponseSchema },
} as const;
