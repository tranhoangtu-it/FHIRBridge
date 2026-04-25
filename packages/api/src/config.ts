/**
 * Configuration loader for the FHIRBridge API server.
 * Validates all required environment variables at startup via Zod schema.
 * Fails fast with descriptive errors on misconfiguration.
 */

import { z } from 'zod';

/** User tier for rate limiting */
export type UserTier = 'free' | 'paid';

/** Typed API server configuration — inferred from Zod schema */
export type ApiConfig = z.infer<typeof ApiConfigSchema>;

// ── Zod schema ────────────────────────────────────────────────────────────────

const ApiConfigSchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535).default(3001),

    host: z.string().default('0.0.0.0'),

    jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

    hmacSecret: z.string().min(32, 'HMAC_SECRET must be at least 32 characters'),

    apiKeys: z
      .string()
      .default('')
      .transform((raw) =>
        raw
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      ),

    corsOrigins: z
      .string()
      .default('http://localhost:3000')
      .transform((raw) =>
        raw
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),

    databaseUrl: z.string().url('DATABASE_URL must be a valid URL').optional(),

    redisUrl: z.string().url('REDIS_URL must be a valid URL').optional(),

    logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

    trustProxy: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val === 'false') return false;
        if (val === 'true') return true;
        return val; // CIDR string like '10.0.0.0/8'
      }),

    metricsBearerToken: z.string().min(16).optional(),
  })
  .superRefine((data, ctx) => {
    // HMAC_SECRET must differ from JWT_SECRET to prevent key reuse
    if (data.hmacSecret === data.jwtSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hmacSecret'],
        message: 'HMAC_SECRET must be different from JWT_SECRET (key reuse is a security risk)',
      });
    }
  });

/** Load and validate configuration from environment variables. Throws on failure. */
export function loadConfig(): ApiConfig {
  const raw = {
    port: process.env['PORT'],
    host: process.env['HOST'],
    jwtSecret: process.env['JWT_SECRET'],
    hmacSecret: process.env['HMAC_SECRET'] ?? process.env['JWT_SECRET'],
    apiKeys: process.env['API_KEYS'],
    corsOrigins: process.env['CORS_ORIGINS'],
    databaseUrl: process.env['DATABASE_URL'],
    redisUrl: process.env['REDIS_URL'],
    logLevel: process.env['LOG_LEVEL'],
    trustProxy: process.env['TRUST_PROXY'],
    metricsBearerToken: process.env['METRICS_BEARER_TOKEN'],
  };

  const result = ApiConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`FHIRBridge configuration error:\n${messages}`);
  }

  return result.data;
}
