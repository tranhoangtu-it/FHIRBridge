/**
 * Export service — orchestrates connector → bundle assembly.
 * Supports Redis-backed store (optional) with in-memory fallback.
 * No PHI in service-level logs.
 */

import { randomUUID } from 'node:crypto';
import { FhirEndpointConnector, BundleBuilder } from '@fhirbridge/core';
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

/** Maximum resources per export to prevent OOM */
const MAX_RESOURCES = 10_000;

/** ~5 MB threshold for skipping Redis (large bundles stay in-memory) */
const MAX_REDIS_BYTES = 5 * 1024 * 1024;

/** TTL for export records: 10 minutes */
const EXPORT_TTL_SECONDS = 10 * 60;

/** In-memory store TTL (ms) used when no Redis store is provided */
const STORE_TTL_MS = EXPORT_TTL_SECONDS * 1000;

/** Block private/internal IPs to prevent SSRF */
function validateBaseUrl(url: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254',
    'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) throw new Error('Internal endpoints are not allowed');
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
    throw new Error('Private IP ranges are not allowed');
  }
}

export class ExportService {
  /** In-memory fallback store (used when no RedisStore provided) */
  private readonly memStore = new Map<string, ExportRecord>();
  private readonly redis: IRedisStore | null;

  constructor(redisStore?: IRedisStore) {
    this.redis = redisStore ?? null;
  }

  private async storeRecord(exportId: string, record: ExportRecord): Promise<void> {
    if (this.redis) {
      // Don't store large bundles in Redis
      const serialized = JSON.stringify(record);
      if (serialized.length > MAX_REDIS_BYTES) {
        console.warn(`[ExportService] bundle for ${exportId} exceeds 5 MB, keeping in-memory`);
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
    // Also check in-memory (large bundles or Redis-miss fallback)
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
      // SSRF protection: validate baseUrl before connecting
      if ('baseUrl' in request.connectorConfig) {
        validateBaseUrl(request.connectorConfig.baseUrl as string);
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
}
