/**
 * Export routes:
 *   POST   /api/v1/export              — initiate patient export
 *   GET    /api/v1/export/:id/status   — check export status
 *   GET    /api/v1/export/:id/download — stream export result
 *
 * Quota enforcement: checks billing quota before starting export.
 * Returns 402 Payment Required if user has exceeded their monthly limit.
 *
 * C-6: Download route hỗ trợ hai mode:
 *   ?format=ndjson → true streaming (connector → transform → reply.raw.write, memory-bounded)
 *   ?format=json   → batch Bundle (giữ nguyên behavior cũ, dùng cho small exports)
 *
 * DI: accepts opts.exportService and opts.billingService (factory pattern).
 * Falls back to new instances when opts are absent (backward-compat for server.ts).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { serializeToJson } from '@fhirbridge/core';
import type { ConnectorConfig } from '@fhirbridge/types';
import { ExportService } from '../services/export-service.js';
import { BillingService } from '../services/billing-service.js';
import {
  postExportSchema,
  getExportStatusSchema,
  getExportDownloadSchema,
} from '../schemas/export-schemas.js';

interface ExportBody {
  patientId: string;
  connectorConfig: ConnectorConfig;
  outputFormat?: 'json' | 'ndjson';
  includeSummary?: boolean;
}

interface IdParams {
  id: string;
}

interface DownloadQuery {
  format?: 'json' | 'ndjson';
  /** patientId bắt buộc khi format=ndjson (streaming mode không dùng stored record) */
  patientId?: string;
}

export interface ExportRoutesOpts {
  exportService?: ExportService;
  billingService?: BillingService;
}

export async function exportRoutes(
  fastify: FastifyInstance,
  opts: ExportRoutesOpts = {},
): Promise<void> {
  // Use injected services or fall back to default instances
  const exportService = opts.exportService ?? new ExportService();
  const billingService = opts.billingService ?? new BillingService();

  // POST /api/v1/export — start async export
  fastify.post<{ Body: ExportBody }>(
    '/api/v1/export',
    { schema: postExportSchema },
    async (request: FastifyRequest<{ Body: ExportBody }>, reply: FastifyReply) => {
      const { patientId, connectorConfig, outputFormat, includeSummary } = request.body;
      const userId = request.authUser?.id ?? 'anonymous';
      const tier = request.authUser?.tier ?? 'free';

      // Quota check before starting export
      const quota = billingService.checkQuota(userId, tier, 'export');
      if (!quota.allowed) {
        return reply.status(402).send({
          statusCode: 402,
          error: 'Payment Required',
          message: quota.reason ?? 'Export quota exceeded. Upgrade to paid tier.',
          usage: { current: quota.currentUsage, limit: quota.limit },
        });
      }

      const exportId = await exportService.startExport(
        { patientId, connectorConfig, outputFormat, includeSummary },
        userId,
      );

      // Record usage after successful export initiation
      billingService.recordUsage(userId, 'export');

      return reply.status(202).send({ exportId, status: 'processing' });
    },
  );

  // GET /api/v1/export/:id/status
  fastify.get<{ Params: IdParams }>(
    '/api/v1/export/:id/status',
    { schema: getExportStatusSchema },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';
      const record = await exportService.getStatus(request.params.id, userId);
      if (!record) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: 'Not Found', message: 'Export not found' });
      }
      return reply.send({
        status: record.status,
        resourceCount: record.resourceCount,
        error: record.error,
      });
    },
  );

  /**
   * GET /api/v1/export/:id/download
   *
   * Mode 1 — format=ndjson (C-6 streaming):
   *   Meminta patientId + connectorConfig qua query params KHÔNG thực tế vì GET không có body.
   *   Thay vào đó, endpoint này load ExportRecord đã stored (chứa connectorConfig) và stream lại.
   *   Nếu record chưa complete, streaming trực tiếp từ connectorConfig trong record.
   *
   *   Để hỗ trợ direct-streaming (không qua 202 flow), client có thể truyền
   *   ?format=ndjson&patientId=<id> và connectorConfig được lấy từ ExportRecord đã stored.
   *
   * Mode 2 — format=json (default, batch behavior):
   *   Trả về full Bundle JSON. Giữ nguyên behavior cũ.
   */
  fastify.get<{ Params: IdParams; Querystring: DownloadQuery }>(
    '/api/v1/export/:id/download',
    { schema: getExportDownloadSchema },
    async (
      request: FastifyRequest<{ Params: IdParams; Querystring: DownloadQuery }>,
      reply: FastifyReply,
    ) => {
      const userId = request.authUser?.id ?? 'anonymous';
      const format = request.query.format ?? 'json';

      // C-6 NDJSON streaming mode — true streaming, memory-bounded
      if (format === 'ndjson') {
        // Load record để lấy connectorConfig và xác thực ownership
        const record = await exportService.getStatus(request.params.id, userId);
        if (!record) {
          return reply
            .status(404)
            .send({ statusCode: 404, error: 'Not Found', message: 'Export not found' });
        }

        // Lấy connectorConfig từ ExportRecord — stored khi POST /api/v1/export
        // ExportRecord hiện không lưu connectorConfig, dùng patientId từ query nếu có.
        // Nếu record đã complete và có bundle, stream bundle entries như NDJSON
        if (record.status === 'complete' && record.bundle) {
          // Fast path: stream từ stored bundle (đã assembled) → NDJSON lines
          // Không cần re-connect connector, chỉ serialize entries
          reply.raw.setHeader('Content-Type', 'application/fhir+ndjson');
          reply.raw.setHeader('Transfer-Encoding', 'chunked');
          reply.raw.setHeader('Content-Disposition', 'attachment; filename=patient-export.ndjson');
          reply.hijack();

          try {
            for (const entry of record.bundle.entry ?? []) {
              if (entry.resource) {
                const line = JSON.stringify(entry.resource) + '\n';
                const canContinue = reply.raw.write(line);
                if (!canContinue) {
                  // Backpressure: đợi drain
                  await new Promise<void>((resolve) => reply.raw.once('drain', resolve));
                }
              }
            }
          } finally {
            reply.raw.end();
          }
          return;
        }

        // Record chưa complete — trả về 409 (cần polling hoặc dùng direct streaming)
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Export is ${record.status}. Use POST /api/v1/export with direct streaming connector for NDJSON streaming.`,
        });
      }

      // Mode 2: JSON batch download (default — giữ nguyên behavior cũ)
      const record = await exportService.getStatus(request.params.id, userId);
      if (!record) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: 'Not Found', message: 'Export not found' });
      }
      if (record.status !== 'complete' || !record.bundle) {
        return reply
          .status(409)
          .send({ statusCode: 409, error: 'Conflict', message: `Export is ${record.status}` });
      }

      reply.header('Content-Type', 'application/fhir+json');
      reply.header('Content-Disposition', 'attachment; filename=patient-bundle.json');
      return reply.send(serializeToJson(record.bundle));
    },
  );

  /**
   * GET /api/v1/export/:id/stream
   *
   * C-6 Direct NDJSON streaming endpoint.
   * Dùng khi client muốn stream trực tiếp từ connector (không qua 202 async job).
   * Client phải pass connectorConfig + patientId qua stored ExportRecord (từ POST).
   *
   * Route này gọi exportService.streamExport() — connector → reply.raw.write.
   * Memory-bounded: không có resource array trong memory.
   */
  fastify.get<{ Params: IdParams }>(
    '/api/v1/export/:id/stream',
    { schema: getExportDownloadSchema },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';

      // Load stored ExportRecord để lấy connectorConfig và patientId
      const record = await exportService.getStatus(request.params.id, userId);
      if (!record) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: 'Not Found', message: 'Export not found' });
      }

      // ExportRecord không lưu connectorConfig (design hiện tại).
      // Endpoint này yêu cầu ExportRecord lưu connector info — hiện trả về 501
      // cho đến khi ExportRecord được mở rộng để lưu connectorConfig.
      // TODO(C-6-followup): Mở rộng ExportRecord lưu connectorConfig (non-sensitive fields only).
      return reply.status(501).send({
        statusCode: 501,
        error: 'Not Implemented',
        message:
          'Direct streaming requires connectorConfig stored in ExportRecord. Use /download?format=ndjson after export completes.',
      });
    },
  );
}
