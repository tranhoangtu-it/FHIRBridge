/**
 * Fastify server factory.
 * Creates and configures a Fastify instance with all plugins and routes.
 * Does NOT start listening — call server.listen() from index.ts.
 *
 * Nhận ServerOpts để inject pre-built services vào từng route plugin.
 * Backward-compat: nếu opts là ApiConfig thuần (không có services), tự build sinks.
 */

import fastifyMultipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';

import type { ApiConfig } from './config.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { auditPlugin } from './plugins/audit-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { corsPlugin } from './plugins/cors-plugin.js';
import { idempotencyPlugin } from './plugins/idempotency-plugin.js';
import { metricsPlugin } from './plugins/metrics-plugin.js';
import { rateLimiterPlugin } from './plugins/rate-limiter-plugin.js';
import { requestIdPlugin } from './plugins/request-id-plugin.js';
import { securityHeadersPlugin } from './plugins/security-headers-plugin.js';
import { swaggerPlugin } from './plugins/swagger-plugin.js';
import { traceContextPlugin } from './plugins/trace-context-plugin.js';
import { billingRoutes } from './routes/billing-routes.js';
import { consentRoutes } from './routes/consent-routes.js';
import { connectorRoutes } from './routes/connector-routes.js';
import { exportRoutes } from './routes/export-routes.js';
import { healthRoutes } from './routes/health-routes.js';
import { summaryRoutes } from './routes/summary-routes.js';
import { webhookRoutes } from './routes/webhook-routes.js';
import { AuditService, ConsoleAuditSink } from './services/audit-service.js';
import { PostgresAuditSink } from './services/postgres-audit-sink.js';
import type { IRedisStore } from './services/redis-store.js';
import type { ExportService } from './services/export-service.js';
import type { SummaryService } from './services/summary-service.js';
import type { BillingService } from './services/billing-service.js';
import type { INonceStore, IUsageTracker } from '@fhirbridge/core';
import type { WebhookSubscriptionStore } from './services/webhook-subscription-store.js';

/** Max upload size for multipart (50 MB) */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Dependency-injected options cho createServer.
 * Tất cả services đều optional — fallback to in-memory/console khi absent.
 */
export interface ServerOpts {
  config: ApiConfig;
  /** Audit sink — PostgresAuditSink trong prod, ConsoleAuditSink trong dev/test */
  auditSink?: PostgresAuditSink | InstanceType<typeof ConsoleAuditSink>;
  /** Redis-backed generic store — optional, falls back to in-memory */
  redisStore?: IRedisStore;
  /** Usage tracker — PostgresUsageTracker trong prod, InMemoryUsageTracker trong dev */
  usageTracker?: IUsageTracker;
  /** Nonce store cho webhook replay protection — RedisNonceStore trong prod */
  nonceStore?: INonceStore;
  /** Pre-built export service */
  exportService?: ExportService;
  /** Pre-built summary service */
  summaryService?: SummaryService;
  /** Pre-built billing service */
  billingService?: BillingService;
  /** Webhook subscription store — shared với webhookRoutes */
  webhookSubscriptionStore?: WebhookSubscriptionStore;
}

/**
 * Create and configure Fastify instance.
 * Accepts either ServerOpts (DI form) or bare ApiConfig (backward-compat).
 *
 * Plugin registration order:
 *   swagger → securityHeaders → requestId → cors → multipart
 *   → auth → rateLimiter → audit → routes
 *
 * swagger phải đứng trước routes để collect schemas.
 * securityHeaders đứng sớm để cover toàn bộ responses.
 */
export async function createServer(optsOrConfig: ServerOpts | ApiConfig): Promise<FastifyInstance> {
  // Backward-compat: nếu truyền vào là ApiConfig thuần (không có services field),
  // wrap lại thành ServerOpts để code bên dưới dùng chung một path.
  const opts: ServerOpts =
    'config' in optsOrConfig ? optsOrConfig : { config: optsOrConfig as ApiConfig };

  const { config } = opts;

  const fastify = Fastify({
    logger: { level: config.logLevel },
    requestIdHeader: 'x-request-id',
    // Use specific proxy CIDRs in production instead of true
    // e.g., trustProxy: '10.0.0.0/8' for internal load balancers
    trustProxy: config.trustProxy ?? false,
  });

  // ── Audit sink setup ──────────────────────────────────────────────────────────
  // Ưu tiên injected sink; nếu không có thì tự khởi tạo từ config.
  let postgresAuditSink: PostgresAuditSink | null = null;
  let resolvedAuditSink: InstanceType<typeof ConsoleAuditSink> | PostgresAuditSink;

  if (opts.auditSink) {
    // Sink đã được inject từ ngoài — dùng trực tiếp
    resolvedAuditSink = opts.auditSink;
    if (opts.auditSink instanceof PostgresAuditSink) {
      postgresAuditSink = opts.auditSink;
    }
    fastify.log.info('[Server] using injected auditSink');
  } else if (config.databaseUrl) {
    postgresAuditSink = new PostgresAuditSink(config.databaseUrl);
    resolvedAuditSink = postgresAuditSink;
    fastify.log.info('[Server] using PostgresAuditSink');
  } else {
    resolvedAuditSink = new ConsoleAuditSink();
    fastify.log.info('[Server] using ConsoleAuditSink (no DATABASE_URL configured)');
  }

  const auditService = new AuditService(resolvedAuditSink);

  // 0a. Swagger/OpenAPI — trước routes để collect schemas (chỉ bật ngoài prod hoặc khi ENABLE_DOCS=true)
  await fastify.register(swaggerPlugin);

  // 0b. Security headers (helmet) — áp dụng sớm cho mọi response
  await fastify.register(securityHeadersPlugin);

  // 1. Request ID — must be first so subsequent plugins/hooks have it
  await fastify.register(requestIdPlugin);

  // 1b. W3C Trace Context (H-18) — parse/emit traceparent; runs before other hooks so request.trace is available
  await fastify.register(traceContextPlugin);

  // 1c. Metrics (FR-O3) — records onRequest/onResponse; exposes /metrics
  await fastify.register(metricsPlugin, { bearerToken: config.metricsBearerToken });

  // 2. CORS — before auth so preflight requests pass
  await fastify.register(corsPlugin, { config });

  // 3. Multipart support — register before routes that use it
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  // 4. Auth — validates JWT/API key
  await fastify.register(authPlugin, { config });

  // 4b. Idempotency-Key (H-11) — after auth so userId is on request
  await fastify.register(idempotencyPlugin);

  // 5. Rate limiter — runs after auth so user tier is available
  //    Pass redisUrl so it uses distributed rate limiting when available
  await fastify.register(rateLimiterPlugin, { redisUrl: config.redisUrl });

  // 6. Audit — onResponse hook, after all request processing
  await fastify.register(auditPlugin, { config, auditService });

  // ── Routes — inject pre-built services, fallback to default instances ─────────
  await fastify.register(healthRoutes, {
    config,
    postgresAuditSink: postgresAuditSink ?? undefined,
    redisStore: opts.redisStore,
  });

  await fastify.register(exportRoutes, {
    exportService: opts.exportService,
    billingService: opts.billingService,
  });

  await fastify.register(connectorRoutes);

  await fastify.register(summaryRoutes, { config });

  await fastify.register(billingRoutes);

  await fastify.register(consentRoutes, { auditSink: resolvedAuditSink });

  // Webhook routes — requires subscriptionStore; skip gracefully when absent (backward-compat)
  if (opts.webhookSubscriptionStore) {
    await fastify.register(webhookRoutes, {
      subscriptionStore: opts.webhookSubscriptionStore,
    });
  }

  // Centralized error handler
  registerErrorHandler(fastify);

  // Graceful shutdown cho Postgres audit sink (chỉ khi server tự tạo — tránh double-shutdown)
  if (postgresAuditSink && !opts.auditSink) {
    const sink = postgresAuditSink;
    fastify.addHook('onClose', async () => {
      await sink.shutdown();
    });
  }

  return fastify;
}
