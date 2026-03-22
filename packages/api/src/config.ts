/**
 * Configuration loader for the FHIRBridge API server.
 * Reads environment variables and produces a typed config object.
 * Validates required fields at startup — throws on missing critical vars.
 */

/** User tier for rate limiting */
export type UserTier = 'free' | 'paid';

/** Typed API server configuration */
export interface ApiConfig {
  port: number;
  host: string;
  jwtSecret: string;
  /** Comma-separated list of valid API keys */
  apiKeys: string[];
  corsOrigins: string[];
  /** Optional — used for health check reporting */
  databaseUrl?: string;
  /** Optional — used for health check reporting */
  redisUrl?: string;
  /** HMAC secret for de-identification (passed to core) */
  hmacSecret: string;
  /** Log level for Fastify/Pino */
  logLevel: string;
  /** Proxy trust setting — use CIDR range in production, false by default */
  trustProxy?: boolean | string;
}

/** Load and validate configuration from environment variables */
export function loadConfig(): ApiConfig {
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('Missing required env var: JWT_SECRET');
  }

  const hmacSecret = process.env['HMAC_SECRET'] ?? jwtSecret;

  const apiKeysRaw = process.env['API_KEYS'] ?? '';
  const apiKeys = apiKeysRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const corsOriginsRaw = process.env['CORS_ORIGINS'] ?? 'http://localhost:3000';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    jwtSecret,
    hmacSecret,
    apiKeys,
    corsOrigins,
    databaseUrl: process.env['DATABASE_URL'],
    redisUrl: process.env['REDIS_URL'],
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    trustProxy:
      process.env['TRUST_PROXY'] === 'true'
        ? true
        : process.env['TRUST_PROXY']
          ? process.env['TRUST_PROXY']
          : false,
  };
}
