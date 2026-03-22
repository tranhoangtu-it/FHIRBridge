/**
 * JSON Schema definitions for export routes.
 * Uses plain objects (no TypeBox) to avoid additional dependencies.
 */

export const exportRequestSchema = {
  type: 'object',
  required: ['patientId', 'connectorConfig'],
  properties: {
    patientId: { type: 'string', minLength: 1 },
    connectorConfig: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['fhir-endpoint', 'csv', 'excel'] },
        baseUrl: { type: 'string' },
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        tokenEndpoint: { type: 'string' },
      },
      additionalProperties: true,
    },
    outputFormat: { type: 'string', enum: ['json', 'ndjson'], default: 'json' },
    includeSummary: { type: 'boolean', default: false },
    summaryConfig: { type: 'object', additionalProperties: true },
  },
  additionalProperties: false,
} as const;

export const exportStatusParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const postExportSchema = {
  body: exportRequestSchema,
  response: {
    202: {
      type: 'object',
      properties: {
        exportId: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
} as const;

export const getExportStatusSchema = {
  params: exportStatusParamsSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['processing', 'complete', 'failed'] },
        resourceCount: { type: 'number' },
        error: { type: 'string' },
      },
    },
  },
} as const;

export const getExportDownloadSchema = {
  params: exportStatusParamsSchema,
} as const;
