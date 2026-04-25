/**
 * @fhirbridge/api entry point.
 * Loads config via Zod, wires tất cả sinks/stores/services, tạo Fastify server,
 * và bắt đầu listen. Xử lý graceful shutdown khi SIGTERM/SIGINT.
 *
 * Bootstrap order:
 *   1. Config validation (Zod — fail fast)
 *   2. Redis client (optional)
 *   3. Stores: RedisStore, NonceStore (Redis nếu có, else in-memory)
 *   4. Sinks: AuditSink (Postgres nếu có, else Console)
 *   5. Tracker: UsageTracker (InMemory — Postgres variant cần IUsageTracker adapter riêng)
 *   6. Services: ExportService, SummaryService, BillingService
 *   7. Server: createServer với tất cả services đã wire
 *   8. Graceful shutdown hooks
 */

import 'dotenv/config';
import Redis from 'ioredis';
import { InMemoryNonceStore, InMemoryUsageTracker } from '@fhirbridge/core';
import { PostgresUsageTracker } from './services/postgres-usage-tracker.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { RedisStore } from './services/redis-store.js';
import { RedisNonceStore } from './services/redis-nonce-store.js';
import { PostgresAuditSink } from './services/postgres-audit-sink.js';
import { AuditService, ConsoleAuditSink } from './services/audit-service.js';
import { ExportService } from './services/export-service.js';
import { SummaryService } from './services/summary-service.js';
import { BillingService } from './services/billing-service.js';
import { WebhookSubscriptionStore } from './services/webhook-subscription-store.js';
import { WebhookDispatcher } from './services/webhook-dispatcher.js';

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
    // Non-blocking connect — nếu Redis fail thì stores fallback to in-memory
    redisClient.connect().catch((err: Error) => {
      console.warn('[Bootstrap] Redis connect failed, nonce store will be in-memory:', err.message);
    });
  }

  // ── 3. Stores ─────────────────────────────────────────────────────────────────
  // RedisStore — dùng cho ExportService/SummaryService job records
  const redisStore = config.redisUrl
    ? new RedisStore({ url: config.redisUrl, keyPrefix: 'fhirbridge:' })
    : null;

  // NonceStore — RedisNonceStore khi có Redis (multi-replica safe), else in-memory
  // PRODUCTION: chỉ cần set REDIS_URL là active, không cần code thay đổi
  const nonceStore = redisClient ? new RedisNonceStore(redisClient) : new InMemoryNonceStore();

  // ── 4. Audit sink ─────────────────────────────────────────────────────────────
  const auditSink = config.databaseUrl
    ? new PostgresAuditSink(config.databaseUrl)
    : new ConsoleAuditSink();

  // AuditService dùng chung cho services (SummaryService cần để log IDOR denial)
  const auditService = new AuditService(auditSink);

  // ── 5. Usage tracker ──────────────────────────────────────────────────────────
  // PostgresUsageTracker khi có DATABASE_URL: persistent, cross-restart, multi-replica safe.
  // Fallback InMemoryUsageTracker: per-pod, không persistent, không multi-replica safe.
  const usageTracker = config.databaseUrl
    ? new PostgresUsageTracker(config.databaseUrl)
    : new InMemoryUsageTracker();

  // ── 6. Services ───────────────────────────────────────────────────────────────

  // Webhook store + dispatcher — in-memory v1; swap Postgres-backed in v1.2
  const webhookSubscriptionStore = new WebhookSubscriptionStore();
  const webhookDispatcher = new WebhookDispatcher(
    webhookSubscriptionStore,
    // Reuse console as logger until server logger is available
    console,
  );

  const exportService = new ExportService({
    redis: redisStore ?? undefined,
    webhookDispatcher,
  });

  const summaryService = new SummaryService(
    redisStore ?? undefined,
    webhookDispatcher,
    auditService,
    config.hmacSecret,
  );

  const billingService = new BillingService({ usageTracker });

  // ── 7. Server ─────────────────────────────────────────────────────────────────
  const server = await createServer({
    config,
    auditSink,
    redisStore: redisStore ?? undefined,
    usageTracker,
    nonceStore,
    exportService,
    summaryService,
    billingService,
    webhookSubscriptionStore,
  });

  // ── 8. Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();

      // Flush pending audit entries trước khi đóng sink
      if (auditSink instanceof PostgresAuditSink) {
        await auditSink.shutdown();
      }

      // Đóng usage tracker pool nếu dùng Postgres-backed
      if (usageTracker instanceof PostgresUsageTracker) {
        await usageTracker.shutdown();
      }

      // Đóng Redis client sau khi server đã closed (không còn request nào mới)
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

  // ── Start listening ───────────────────────────────────────────────────────────
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
