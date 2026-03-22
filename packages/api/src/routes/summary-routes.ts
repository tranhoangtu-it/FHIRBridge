/**
 * Summary routes:
 *   POST /api/v1/summary/generate    — generate AI summary
 *   GET  /api/v1/summary/:id/download — download formatted summary
 *
 * Quota enforcement: AI summaries are only available on paid tier.
 * Returns 402 Payment Required if user is on free tier.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Bundle } from '@fhirbridge/types';
import type { ApiConfig } from '../config.js';
import { SummaryService, type SummaryRequestOptions } from '../services/summary-service.js';
import { BillingService } from '../services/billing-service.js';
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
const billingService = new BillingService();

export async function summaryRoutes(
  fastify: FastifyInstance,
  opts: { config: ApiConfig },
): Promise<void> {
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

      const userId = request.authUser?.id ?? 'anonymous';
      const tier = request.authUser?.tier ?? 'free';

      // Quota check: AI summaries require paid tier
      const quota = billingService.checkQuota(userId, tier, 'summary');
      if (!quota.allowed) {
        return reply.status(402).send({
          statusCode: 402,
          error: 'Payment Required',
          message: quota.reason ?? 'AI summaries require a paid subscription ($5/month).',
        });
      }

      const summaryId = await summaryService.startGeneration({
        bundle,
        summaryConfig: summaryConfig as SummaryRequestOptions | undefined,
        hmacSecret: opts.config.hmacSecret,
      });

      // Record usage after successful summary initiation
      billingService.recordUsage(userId, 'summary');

      return reply.status(202).send({ summaryId, status: 'processing' });
    },
  );

  // GET /api/v1/summary/:id/download
  fastify.get<{ Params: IdParams; Querystring: DownloadQuery }>(
    '/api/v1/summary/:id/download',
    { schema: getSummaryDownloadSchema },
    async (
      request: FastifyRequest<{ Params: IdParams; Querystring: DownloadQuery }>,
      reply: FastifyReply,
    ) => {
      const record = await summaryService.getStatus(request.params.id);
      if (!record) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: 'Not Found', message: 'Summary not found' });
      }
      if (record.status !== 'complete' || !record.summary) {
        return reply
          .status(409)
          .send({ statusCode: 409, error: 'Conflict', message: `Summary is ${record.status}` });
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
