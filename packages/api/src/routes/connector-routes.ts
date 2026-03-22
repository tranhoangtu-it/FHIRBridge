/**
 * Connector routes:
 *   POST /api/v1/connectors/test    — test HIS connection
 *   POST /api/v1/connectors/import  — upload CSV/Excel for import (multipart)
 */

import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline as streamPipeline } from 'node:stream/promises';

import { FhirEndpointConnector, BundleBuilder, CsvConnector } from '@fhirbridge/core';
import type { FhirEndpointConfig, Resource, ColumnMapping } from '@fhirbridge/types';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { postConnectorTestSchema } from '../schemas/connector-schemas.js';

interface ConnectorTestBody {
  type: 'fhir-endpoint';
  config: FhirEndpointConfig;
}

/** SSRF protection: block private/internal IPs */
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

export async function connectorRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/connectors/test
  fastify.post<{ Body: ConnectorTestBody }>(
    '/api/v1/connectors/test',
    { schema: postConnectorTestSchema },
    async (request: FastifyRequest<{ Body: ConnectorTestBody }>, reply: FastifyReply) => {
      const { config } = request.body;

      try {
        validateBaseUrl(config.baseUrl);
        const connector = new FhirEndpointConnector();
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

  // POST /api/v1/connectors/import — multipart CSV/Excel upload → FHIR Bundle
  fastify.post(
    '/api/v1/connectors/import',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.isMultipart()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Expected multipart/form-data',
        });
      }

      const tempFile = join(tmpdir(), `fhirbridge-import-${randomUUID()}.csv`);
      try {
        const parts = request.parts();
        let mappingConfig: Record<string, unknown> | undefined;

        for await (const part of parts) {
          if (part.type === 'file') {
            // Stream file to temp location
            const writeStream = createWriteStream(tempFile);
            await streamPipeline(part.file, writeStream);
          } else if (part.fieldname === 'mapping') {
            mappingConfig = JSON.parse(part.value as string);
          }
        }

        // Process CSV through pipeline
        const connector = new CsvConnector();
        await connector.connect({
          type: 'csv',
          filePath: tempFile,
          mapping: ((mappingConfig as Record<string, unknown>)?.columns ?? []) as ColumnMapping[],
        });

        const builder = new BundleBuilder();
        let resourceCount = 0;
        for await (const record of connector.fetchPatientData('*')) {
          if (++resourceCount > 10_000) break; // Safety limit
          builder.addResource(record.data as unknown as Resource);
        }
        await connector.disconnect();

        const bundle = builder.build();
        return reply.status(200).send({
          message: 'Import complete',
          resourceCount: bundle.entry?.length ?? 0,
          bundle,
        });
      } catch (err) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'File import processing failed',
        });
      } finally {
        // Cleanup temp file — privacy: no PHI persisted
        await unlink(tempFile).catch(() => {});
      }
    },
  );
}
