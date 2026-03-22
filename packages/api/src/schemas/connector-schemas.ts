/**
 * JSON Schema definitions for connector routes.
 */

export const connectorTestRequestSchema = {
  type: 'object',
  required: ['type', 'config'],
  properties: {
    type: { type: 'string', enum: ['fhir-endpoint'] },
    config: {
      type: 'object',
      required: ['baseUrl'],
      properties: {
        baseUrl: { type: 'string', minLength: 1 },
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        tokenEndpoint: { type: 'string' },
        timeout: { type: 'number' },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const;

export const postConnectorTestSchema = {
  body: connectorTestRequestSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        serverVersion: { type: 'string' },
        error: { type: 'string' },
        checkedAt: { type: 'string' },
      },
    },
  },
} as const;
