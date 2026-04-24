/**
 * Fastify server factory.
 * Creates and configures a Fastify instance with all plugins and routes.
 * Does NOT start listening — call server.listen() from index.ts.
 */

import fastifyMultipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';

import type { ApiConfig } from './config.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { auditPlugin } from './plugins/audit-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { corsPlugin } from './plugins/cors-plugin.js';
import { rateLimiterPlugin } from './plugins/rate-limiter-plugin.js';
import { requestIdPlugin } from './plugins/request-id-plugin.js';
import { securityHeadersPlugin } from './plugins/security-headers-plugin.js';
import { swaggerPlugin } from './plugins/swagger-plugin.js';
import { billingRoutes } from './routes/billing-routes.js';
import { connectorRoutes } from './routes/connector-routes.js';
import { exportRoutes } from './routes/export-routes.js';
import { healthRoutes } from './routes/health-routes.js';
import { summaryRoutes } from './routes/summary-routes.js';
import { AuditService, ConsoleAuditSink } from './services/audit-service.js';
import { PostgresAuditSink } from './services/postgres-audit-sink.js';

/** Max upload size for multipart (50 MB) */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Create and configure Fastify instance.
 * Plugin registration order:
 *   swagger → securityHeaders → requestId → cors → multipart
 *   → auth → rateLimiter → audit → routes
 *
 * swagger phải đứng trước routes để collect schemas.
 * securityHeaders đứng sớm để cover toàn bộ responses.
 */
export async function createServer(config: ApiConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: config.logLevel },
    requestIdHeader: 'x-request-id',
    // Use specific proxy CIDRs in production instead of true
    // e.g., trustProxy: '10.0.0.0/8' for internal load balancers
    trustProxy: config.trustProxy ?? false,
  });

  // Choose audit sink based on config
  let postgresAuditSink: PostgresAuditSink | null = null;
  let auditSink: ConstructorParameters<typeof AuditService>[0] = new ConsoleAuditSink();

  if (config.databaseUrl) {
    postgresAuditSink = new PostgresAuditSink(config.databaseUrl);
    auditSink = postgresAuditSink;
    fastify.log.info('[Server] using PostgresAuditSink');
  } else {
    fastify.log.info('[Server] using ConsoleAuditSink (no DATABASE_URL configured)');
  }

  const auditService = new AuditService(auditSink);

  // 0a. Swagger/OpenAPI — trước routes để collect schemas (chỉ bật ngoài prod hoặc khi ENABLE_DOCS=true)
  await fastify.register(swaggerPlugin);

  // 0b. Security headers (helmet) — áp dụng sớm cho mọi response
  await fastify.register(securityHeadersPlugin);

  // 1. Request ID — must be first so subsequent plugins/hooks have it
  await fastify.register(requestIdPlugin);

  // 2. CORS — before auth so preflight requests pass
  await fastify.register(corsPlugin, { config });

  // 3. Multipart support — register before routes that use it
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  // 4. Auth — validates JWT/API key
  await fastify.register(authPlugin, { config });

  // 5. Rate limiter — runs after auth so user tier is available
  //    Pass redisUrl so it uses distributed rate limiting when available
  await fastify.register(rateLimiterPlugin, { redisUrl: config.redisUrl });

  // 6. Audit — onResponse hook, after all request processing
  await fastify.register(auditPlugin, { config, auditService });

  // Routes
  await fastify.register(healthRoutes, { config });
  await fastify.register(exportRoutes);
  await fastify.register(connectorRoutes);
  await fastify.register(summaryRoutes, { config });
  await fastify.register(billingRoutes);

  // Centralized error handler
  registerErrorHandler(fastify);

  // Graceful shutdown for Postgres audit sink
  if (postgresAuditSink) {
    const sink = postgresAuditSink;
    fastify.addHook('onClose', async () => {
      await sink.shutdown();
    });
  }

  return fastify;
}
