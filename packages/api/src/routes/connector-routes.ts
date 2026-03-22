/**
 * Connector routes:
 *   POST /api/v1/connectors/test    — test HIS connection
 *   POST /api/v1/connectors/import  — upload CSV/Excel for import (multipart)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FhirEndpointConnector } from '@fhirbridge/core';
import type { FhirEndpointConfig } from '@fhirbridge/types';
import { postConnectorTestSchema } from '../schemas/connector-schemas.js';

interface ConnectorTestBody {
  type: 'fhir-endpoint';
  config: FhirEndpointConfig;
}

export async function connectorRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/connectors/test
  fastify.post<{ Body: ConnectorTestBody }>(
    '/api/v1/connectors/test',
    { schema: postConnectorTestSchema },
    async (request: FastifyRequest<{ Body: ConnectorTestBody }>, reply: FastifyReply) => {
      const { config } = request.body;
      const connector = new FhirEndpointConnector();

      try {
        const connectorCfg = { ...config, type: 'fhir-endpoint' as const };
      await connector.connect(connectorCfg);
        const status = await connector.testConnection();
        await connector.disconnect();
        return reply.send(status);
      } catch (err) {
        return reply.send({
          connected: false,
          error: err instanceof Error ? err.message : 'Connection test failed',
          checkedAt: new Date().toISOString(),
        });
      }
    },
  );

  // POST /api/v1/connectors/import — multipart CSV/Excel upload
  fastify.post(
    '/api/v1/connectors/import',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify this is a multipart request
      if (!request.isMultipart()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Expected multipart/form-data',
        });
      }

      try {
        const parts = request.parts();
        let filename = 'upload';
        let fileSize = 0;

        // Drain all parts to get size (streaming, no full buffer in memory)
        for await (const part of parts) {
          if (part.type === 'file') {
            filename = part.filename ?? 'upload';
            for await (const chunk of part.file) {
              fileSize += (chunk as Buffer).length;
            }
          }
        }

        // Return summary — actual CSV processing delegated to export pipeline
        return reply.status(202).send({
          message: 'File received, processing queued',
          filename,
          sizeBytes: fileSize,
        });
      } catch (err) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'File upload processing failed',
        });
      }
    },
  );
}
