/**
 * Fastify server factory.
 * Creates and configures a Fastify instance with all plugins and routes.
 * Does NOT start listening — call server.listen() from index.ts.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import type { ApiConfig } from './config.js';
import { corsPlugin } from './plugins/cors-plugin.js';
import { requestIdPlugin } from './plugins/request-id-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { rateLimiterPlugin } from './plugins/rate-limiter-plugin.js';
import { auditPlugin } from './plugins/audit-plugin.js';
import { AuditService } from './services/audit-service.js';
import { healthRoutes } from './routes/health-routes.js';
import { exportRoutes } from './routes/export-routes.js';
import { connectorRoutes } from './routes/connector-routes.js';
import { summaryRoutes } from './routes/summary-routes.js';
import { registerErrorHandler } from './middleware/error-handler.js';

/** Max upload size for multipart (50 MB) */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Create and configure Fastify instance.
 * Plugin registration order: requestId → cors → auth → rateLimiter → audit → routes
 */
export async function createServer(config: ApiConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: config.logLevel },
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  const auditService = new AuditService();

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
  await fastify.register(rateLimiterPlugin);

  // 6. Audit — onResponse hook, after all request processing
  await fastify.register(auditPlugin, { config, auditService });

  // Routes
  await fastify.register(healthRoutes, { config });
  await fastify.register(exportRoutes);
  await fastify.register(connectorRoutes);
  await fastify.register(summaryRoutes, { config });

  // Centralized error handler
  registerErrorHandler(fastify);

  return fastify;
}
