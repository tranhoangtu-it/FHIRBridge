/**
 * JSON Schema definitions for consent routes.
 * Không dùng TypeBox — giữ nhất quán với các schema file khác trong project.
 */

export const consentRecordBodySchema = {
  type: 'object',
  required: ['type', 'consentVersionHash', 'granted'],
  properties: {
    type: {
      type: 'string',
      enum: ['crossborder_ai'],
    },
    consentVersionHash: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
    granted: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
} as const;

export const postConsentRecordSchema = {
  body: consentRecordBodySchema,
  response: {
    204: {
      type: 'null',
      description: 'Consent recorded successfully',
    },
  },
} as const;
