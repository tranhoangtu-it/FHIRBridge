/**
 * Summary routes:
 *   POST /api/v1/summary/generate    — generate AI summary
 *   GET  /api/v1/summary/:id/download — download formatted summary
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Bundle } from '@fhirbridge/types';
import type { ApiConfig } from '../config.js';
import { SummaryService, type SummaryRequestOptions } from '../services/summary-service.js';
import { postSummaryGenerateSchema, getSummaryDownloadSchema } from '../schemas/summary-schemas.js';

interface SummaryGenerateBody {
  bundle?: Bundle;
  exportId?: string;
  summaryConfig?: Record<string, unknown>;
}

interface IdParams {
  id: string;
}

interface DownloadQuery {
  format?: 'markdown' | 'composition';
}

const summaryService = new SummaryService();

export async function summaryRoutes(fastify: FastifyInstance, opts: { config: ApiConfig }): Promise<void> {
  // POST /api/v1/summary/generate
  fastify.post<{ Body: SummaryGenerateBody }>(
    '/api/v1/summary/generate',
    { schema: postSummaryGenerateSchema },
    async (request: FastifyRequest<{ Body: SummaryGenerateBody }>, reply: FastifyReply) => {
      const { bundle, summaryConfig } = request.body;

      if (!bundle) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'bundle is required',
        });
      }

      const summaryId = await summaryService.startGeneration({
        bundle,
        summaryConfig: summaryConfig as SummaryRequestOptions | undefined,
        hmacSecret: opts.config.hmacSecret,
      });

      return reply.status(202).send({ summaryId, status: 'processing' });
    },
  );

  // GET /api/v1/summary/:id/download
  fastify.get<{ Params: IdParams; Querystring: DownloadQuery }>(
    '/api/v1/summary/:id/download',
    { schema: getSummaryDownloadSchema },
    async (request: FastifyRequest<{ Params: IdParams; Querystring: DownloadQuery }>, reply: FastifyReply) => {
      const record = summaryService.getStatus(request.params.id);
      if (!record) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Summary not found' });
      }
      if (record.status !== 'complete' || !record.summary) {
        return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: `Summary is ${record.status}` });
      }

      const format = request.query.format ?? 'markdown';
      if (format === 'composition') {
        reply.header('Content-Type', 'application/fhir+json');
        reply.header('Content-Disposition', 'attachment; filename=summary-composition.json');
        return reply.send(JSON.stringify(record.summary));
      }

      reply.header('Content-Type', 'text/markdown; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename=patient-summary.md');
      return reply.send(record.formattedMarkdown ?? '');
    },
  );
}
