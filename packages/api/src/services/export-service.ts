/**
 * Export service — orchestrates connector → bundle assembly.
 * Supports Redis-backed store (optional) with in-memory fallback.
 * No PHI in service-level logs.
 *
 * C-6: streamExport() cho NDJSON streaming trực tiếp.
 * Memory-bounded — không gom resource array, stream-through only.
 */

import { randomUUID, createHmac } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  FhirEndpointConnector,
  BundleBuilder,
  serializeResourceAsNdjsonLine,
  validateBaseUrl,
} from '@fhirbridge/core';
import type { Bundle, ConnectorConfig, Resource } from '@fhirbridge/types';
import type { IRedisStore } from './redis-store.js';

export interface ExportRequest {
  patientId: string;
  connectorConfig: ConnectorConfig;
  outputFormat?: 'json' | 'ndjson';
  includeSummary?: boolean;
}

export type ExportStatus = 'processing' | 'complete' | 'failed';

export interface ExportRecord {
  status: ExportStatus;
  userId: string;
  bundle?: Bundle;
  resourceCount?: number;
  error?: string;
  createdAt: number;
}

/** Tham số cho streamExport */
export interface StreamExportOpts {
  patientId: string;
  connectorConfig: ConnectorConfig;
  userId: string;
}

/** Maximum resources per export to prevent OOM */
const MAX_RESOURCES = 10_000;

/** ~5 MB threshold for skipping Redis (large bundles stay in-memory) */
const MAX_REDIS_BYTES = 5 * 1024 * 1024;

/** TTL for export records: 10 minutes */
const EXPORT_TTL_SECONDS = 10 * 60;

/** In-memory store TTL (ms) used when no Redis store is provided */
const STORE_TTL_MS = EXPORT_TTL_SECONDS * 1000;

/**
 * Hash userId cho audit log — không log raw userId (privacy).
 * Dùng SHA-256 truncated 16 chars, không cần HMAC key vì chỉ dùng cho audit.
 */
function hashUserId(userId: string): string {
  return createHmac('sha256', 'audit-salt').update(userId).digest('hex').slice(0, 16);
}

export interface ExportServiceDeps {
  /** Optional Redis store; falls back to in-memory when absent */
  redis?: IRedisStore;
  /** Optional logger; defaults to console.warn/error when absent */
  logger?: { warn(msg: string): void; error(msg: string): void };
}

export class ExportService {
  /** In-memory fallback store (used when no RedisStore provided) */
  private readonly memStore = new Map<string, ExportRecord>();
  private readonly redis: IRedisStore | null;
  private readonly logger: { warn(msg: string): void; error(msg: string): void };

  /**
   * @param optsOrRedis - Either an ExportServiceDeps object (preferred DI form)
   *   or a bare IRedisStore for backward compatibility with existing callers.
   */
  constructor(optsOrRedis?: IRedisStore | ExportServiceDeps) {
    if (!optsOrRedis) {
      this.redis = null;
      this.logger = console;
    } else if ('set' in optsOrRedis && 'get' in optsOrRedis) {
      this.redis = optsOrRedis as IRedisStore;
      this.logger = console;
    } else {
      const deps = optsOrRedis as ExportServiceDeps;
      this.redis = deps.redis ?? null;
      this.logger = deps.logger ?? console;
    }
  }

  private async storeRecord(exportId: string, record: ExportRecord): Promise<void> {
    if (this.redis) {
      const serialized = JSON.stringify(record);
      if (serialized.length > MAX_REDIS_BYTES) {
        this.logger.warn(`[ExportService] bundle for ${exportId} exceeds 5 MB, keeping in-memory`);
        this.memStore.set(exportId, record);
        return;
      }
      await this.redis.set(exportId, record, EXPORT_TTL_SECONDS);
    } else {
      this.memStore.set(exportId, record);
    }
  }

  private async loadRecord(exportId: string): Promise<ExportRecord | undefined> {
    if (this.redis) {
      const fromRedis = await this.redis.get<ExportRecord>(exportId);
      if (fromRedis) return fromRedis;
    }
    return this.memStore.get(exportId);
  }

  private evictExpiredMemory(): void {
    const now = Date.now();
    for (const [key, record] of this.memStore.entries()) {
      if (now - record.createdAt > STORE_TTL_MS) this.memStore.delete(key);
    }
  }

  /** Kick off async export. Returns exportId immediately (202 pattern). */
  async startExport(request: ExportRequest, userId: string): Promise<string> {
    const exportId = randomUUID();
    const record: ExportRecord = { status: 'processing', userId, createdAt: Date.now() };
    await this.storeRecord(exportId, record);
    this.runExport(exportId, request).catch(() => {
      /* errors stored in record */
    });
    return exportId;
  }

  /** Get current status of an export job — verifies ownership */
  async getStatus(exportId: string, userId: string): Promise<ExportRecord | undefined> {
    this.evictExpiredMemory();
    const record = await this.loadRecord(exportId);
    if (record && record.userId !== userId) return undefined; // IDOR protection
    return record;
  }

  /** Internal: run the full export pipeline */
  private async runExport(exportId: string, request: ExportRequest): Promise<void> {
    const record = (await this.loadRecord(exportId))!;
    try {
      if ('baseUrl' in request.connectorConfig) {
        const ssrfResult = validateBaseUrl(request.connectorConfig.baseUrl as string);
        if (!ssrfResult.ok) {
          throw new Error(ssrfResult.reason);
        }
      }

      const connector = new FhirEndpointConnector();
      await connector.connect(request.connectorConfig);

      const builder = new BundleBuilder();
      let resourceCount = 0;
      for await (const rawRecord of connector.fetchPatientData(request.patientId)) {
        if (++resourceCount > MAX_RESOURCES) {
          throw new Error(`Export exceeded maximum of ${MAX_RESOURCES} resources`);
        }
        builder.addResource(rawRecord.data as unknown as Resource);
      }

      await connector.disconnect();

      const bundle = builder.build();
      record.bundle = bundle;
      record.resourceCount = bundle.entry?.length ?? 0;
      record.status = 'complete';
      await this.storeRecord(exportId, record);
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Export failed';
      await this.storeRecord(exportId, record);
    }
  }

  /**
   * C-6: True NDJSON streaming export — stream resources trực tiếp từ connector đến response.
   *
   * Memory invariant: không gom resource array vào memory.
   * Mỗi resource được serialize thành NDJSON line và write ngay đến reply.raw.
   */
  async streamExport(
    request: FastifyRequest,
    reply: FastifyReply,
    opts: StreamExportOpts,
  ): Promise<void> {
    const { patientId, connectorConfig, userId } = opts;
    const startTime = Date.now();
    let resourceCount = 0;

    // IDOR protection: verify userId khớp với authenticated user
    const authUserId = request.authUser?.id ?? 'anonymous';
    if (authUserId !== userId) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied',
      });
      return;
    }

    if ('baseUrl' in connectorConfig) {
      const ssrfResult = validateBaseUrl(connectorConfig.baseUrl as string);
      if (!ssrfResult.ok) {
        reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: ssrfResult.reason,
        });
        return;
      }
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const onClose = (): void => {
      abortController.abort();
    };
    reply.raw.on('close', onClose);

    reply.raw.setHeader('Content-Type', 'application/fhir+ndjson');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');
    reply.raw.setHeader('Content-Disposition', 'attachment; filename=patient-export.ndjson');
    reply.hijack();

    const connector = new FhirEndpointConnector();

    try {
      await connector.connect(connectorConfig);

      for await (const rawRecord of connector.fetchPatientData(patientId)) {
        if (signal.aborted) break;

        if (++resourceCount > MAX_RESOURCES) {
          const outcome =
            JSON.stringify({
              resourceType: 'OperationOutcome',
              issue: [
                {
                  severity: 'error',
                  code: 'too-costly',
                  details: { text: `Export exceeded maximum of ${MAX_RESOURCES} resources` },
                },
              ],
            }) + '\n';
          await writeChunk(reply.raw, outcome);
          break;
        }

        const resource = rawRecord.data as unknown as Resource;
        const line = serializeResourceAsNdjsonLine(resource);

        const drained = await writeChunk(reply.raw, line);
        if (!drained) {
          await waitForDrain(reply.raw);
        }
      }

      await connector.disconnect();
    } catch (err) {
      if (!signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'Export failed';
        this.logger.error(`[ExportService] streamExport error (no PHI): ${errorMessage}`);

        const outcome =
          JSON.stringify({
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'error',
                code: 'exception',
                details: { text: 'Export stream encountered an error' },
              },
            ],
          }) + '\n';

        try {
          await writeChunk(reply.raw, outcome);
        } catch {
          // Ignore write errors after stream failure
        }
      }
    } finally {
      reply.raw.removeListener('close', onClose);

      const duration = Date.now() - startTime;
      const userIdHash = hashUserId(userId);
      process.nextTick(() => {
        const line = JSON.stringify({
          audit: true,
          ts: new Date().toISOString(),
          user: userIdHash,
          action: 'export.stream',
          status: signal.aborted ? 'aborted' : 'success',
          resources: resourceCount,
          durationMs: duration,
        });
        process.stdout.write(line + '\n');
      });

      reply.raw.end();
    }
  }
}

/**
 * Write một chunk vào NodeJS writable stream với backpressure support.
 * Trả về true nếu buffer chưa đầy (có thể write tiếp ngay),
 * false nếu cần đợi drain event.
 */
function writeChunk(stream: NodeJS.WritableStream, data: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const canContinue = stream.write(data, (err) => {
      if (err) reject(err);
    });
    resolve(canContinue);
  });
}

function waitForDrain(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });
}
