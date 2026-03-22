/**
 * Export service — orchestrates connector → bundle assembly.
 * Uses in-memory Map store (MVP, TTL 10 min).
 * No PHI in service-level logs.
 */

import { randomUUID } from 'node:crypto';
import { FhirEndpointConnector, BundleBuilder } from '@fhirbridge/core';
import type { Bundle, ConnectorConfig, Resource } from '@fhirbridge/types';

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

/** Block private/internal IPs to prevent SSRF */
function validateBaseUrl(url: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.169.254', 'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) throw new Error('Internal endpoints are not allowed');
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
    throw new Error('Private IP ranges are not allowed');
  }
}

/** In-memory store with TTL eviction (10 minutes) */
const exportStore = new Map<string, ExportRecord>();
const STORE_TTL_MS = 10 * 60 * 1000;

function evictExpired(): void {
  const now = Date.now();
  for (const [key, record] of exportStore.entries()) {
    if (now - record.createdAt > STORE_TTL_MS) exportStore.delete(key);
  }
}

export class ExportService {
  /** Kick off async export. Returns exportId immediately (202 pattern). */
  async startExport(request: ExportRequest, userId: string): Promise<string> {
    const exportId = randomUUID();
    exportStore.set(exportId, { status: 'processing', userId, createdAt: Date.now() });
    this.runExport(exportId, request).catch(() => { /* stored in record */ });
    return exportId;
  }

  /** Get current status of an export job — verifies ownership */
  getStatus(exportId: string, userId: string): ExportRecord | undefined {
    evictExpired();
    const record = exportStore.get(exportId);
    if (record && record.userId !== userId) return undefined; // IDOR protection
    return record;
  }

  /** Internal: run the full export pipeline */
  private async runExport(exportId: string, request: ExportRequest): Promise<void> {
    const record = exportStore.get(exportId)!;
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
      exportStore.set(exportId, record);
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Export failed';
      exportStore.set(exportId, record);
    }
  }
}
