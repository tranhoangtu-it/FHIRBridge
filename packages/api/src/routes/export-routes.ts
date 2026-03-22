/**
 * Export routes:
 *   POST   /api/v1/export              — initiate patient export
 *   GET    /api/v1/export/:id/status   — check export status
 *   GET    /api/v1/export/:id/download — stream export result
 *
 * Quota enforcement: checks billing quota before starting export.
 * Returns 402 Payment Required if user has exceeded their monthly limit.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { serializeToJson, serializeToNdjson } from '@fhirbridge/core';
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

const exportService = new ExportService();
const billingService = new BillingService();

export async function exportRoutes(fastify: FastifyInstance): Promise<void> {
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
        {
          patientId,
          connectorConfig,
          outputFormat,
          includeSummary,
        },
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

  // GET /api/v1/export/:id/download — stream bundle
  fastify.get<{ Params: IdParams }>(
    '/api/v1/export/:id/download',
    { schema: getExportDownloadSchema },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const userId = request.authUser?.id ?? 'anonymous';
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

      const format = (request.query as { format?: string }).format ?? 'json';
      if (format === 'ndjson') {
        reply.header('Content-Type', 'application/x-ndjson');
        reply.header('Content-Disposition', 'attachment; filename=patient-bundle.ndjson');
        return reply.send(serializeToNdjson(record.bundle));
      }

      reply.header('Content-Type', 'application/fhir+json');
      reply.header('Content-Disposition', 'attachment; filename=patient-bundle.json');
      return reply.send(serializeToJson(record.bundle));
    },
  );
}
