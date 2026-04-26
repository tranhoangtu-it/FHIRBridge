/**
 * @fhirbridge/api entry point.
 * Loads config via Zod, wires sinks/stores/services, tạo Fastify server,
 * và bắt đầu listen. Xử lý graceful shutdown khi SIGTERM/SIGINT.
 *
 * Self-host edition: no billing / quota / outbound webhooks.
 *
 * Bootstrap order:
 *   1. Config validation (Zod — fail fast)
 *   2. Redis client (optional)
 *   3. Stores: RedisStore (optional, in-memory fallback)
 *   4. Sinks: AuditSink (Postgres nếu có DATABASE_URL, else Console)
 *   5. Services: ExportService, SummaryService
 *   6. Server: createServer với services đã wire
 *   7. Graceful shutdown hooks
 */

import 'dotenv/config';
import Redis from 'ioredis';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { RedisStore } from './services/redis-store.js';
import { PostgresAuditSink } from './services/postgres-audit-sink.js';
import { AuditService, ConsoleAuditSink } from './services/audit-service.js';
import { ExportService } from './services/export-service.js';
import { SummaryService } from './services/summary-service.js';

export { createServer } from './server.js';
export { loadConfig } from './config.js';
export type { ApiConfig } from './config.js';
export type { ServerOpts } from './server.js';

/** Start the server and bind to configured host/port */
export async function startServer(): Promise<void> {
  // ── 1. Config — Zod validation, throw ngay nếu sai ──────────────────────────
  const config = loadConfig();

  // ── 2. Redis client (optional) ───────────────────────────────────────────────
  let redisClient: Redis | null = null;
  if (config.redisUrl) {
    redisClient = new Redis(config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.connect().catch((err: Error) => {
      console.warn('[Bootstrap] Redis connect failed, falling back to in-memory:', err.message);
    });
  }

  // ── 3. Stores ─────────────────────────────────────────────────────────────────
  const redisStore = config.redisUrl
    ? new RedisStore({ url: config.redisUrl, keyPrefix: 'fhirbridge:' })
    : null;

  // ── 4. Audit sink ─────────────────────────────────────────────────────────────
  const auditSink = config.databaseUrl
    ? new PostgresAuditSink(config.databaseUrl)
    : new ConsoleAuditSink();

  const auditService = new AuditService(auditSink);

  // ── 5. Services ───────────────────────────────────────────────────────────────
  const exportService = new ExportService({
    redis: redisStore ?? undefined,
  });

  const summaryService = new SummaryService(
    redisStore ?? undefined,
    auditService,
    config.hmacSecret,
  );

  // ── 6. Server ─────────────────────────────────────────────────────────────────
  const server = await createServer({
    config,
    auditSink,
    redisStore: redisStore ?? undefined,
    exportService,
    summaryService,
  });

  // ── 7. Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();

      if (auditSink instanceof PostgresAuditSink) {
        await auditSink.shutdown();
      }

      if (redisClient) {
        await redisClient.quit().catch(() => redisClient?.disconnect());
      }

      server.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`FHIRBridge API listening on ${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1]?.endsWith('index.js')) {
  void startServer();
}
