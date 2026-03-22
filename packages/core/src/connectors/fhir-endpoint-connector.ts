/**
 * FHIR R4 endpoint connector using fhir-kit-client.
 * Supports SMART on FHIR OAuth2 (standalone launch) and unauthenticated access.
 * Streams Patient/$everything bundles with automatic pagination.
 */

import type { ConnectorConfig, FhirEndpointConfig } from '@fhirbridge/types';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const FhirClient = require('fhir-kit-client');

import type { HisConnector, RawRecord, ConnectionStatus } from './his-connector-interface.js';
import { ConnectorError } from './his-connector-interface.js';
import { withRetry } from './retry-handler.js';

type FhirBundle = {
  resourceType: string;
  entry?: Array<{ resource?: Record<string, unknown> }>;
  link?: Array<{ relation: string; url: string }>;
};

/** FHIR endpoint connector — fetches patient data from a FHIR R4 server */
export class FhirEndpointConnector implements HisConnector {
  readonly type = 'fhir-endpoint' as const;

  private client: InstanceType<typeof FhirClient> | null = null;
  private config: FhirEndpointConfig | null = null;

  async connect(config: ConnectorConfig): Promise<void> {
    if (config.type !== 'fhir-endpoint') {
      throw new ConnectorError('Expected fhir-endpoint config', 'CONFIG_MISMATCH');
    }

    this.config = config;
    this.client = new FhirClient({ baseUrl: config.baseUrl });

    // Authenticate if credentials provided
    if (config.clientId && config.clientSecret && config.tokenEndpoint) {
      await this.authenticate(config);
    }
  }

  async testConnection(): Promise<ConnectionStatus> {
    const baseUrl = this.config?.baseUrl ?? '';

    try {
      const client = this.client ?? new FhirClient({ baseUrl });
      const metadata = (await withRetry(() => client.capabilityStatement())) as Record<
        string,
        unknown
      >;

      return {
        connected: true,
        serverVersion:
          typeof metadata['fhirVersion'] === 'string' ? metadata['fhirVersion'] : undefined,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async *fetchPatientData(patientId: string): AsyncIterable<RawRecord> {
    if (!this.client) {
      throw new ConnectorError('Call connect() before fetchPatientData()', 'NOT_CONNECTED');
    }

    const pageCount = this.config?.pageCount ?? 100;
    const source = `fhir-endpoint:${this.config?.baseUrl ?? 'unknown'}`;

    // Fetch Patient/$everything with pagination
    let nextUrl: string | undefined = undefined;
    let isFirstPage = true;

    while (isFirstPage || nextUrl) {
      isFirstPage = false;

      const bundle: FhirBundle = await withRetry(() => {
        if (nextUrl) {
          return (this.client as NonNullable<typeof this.client>).request(
            nextUrl,
          ) as Promise<FhirBundle>;
        }
        return (this.client as NonNullable<typeof this.client>).request(
          `Patient/${encodeURIComponent(patientId)}/$everything?_count=${pageCount}`,
        ) as Promise<FhirBundle>;
      });

      if (!bundle || bundle.resourceType !== 'Bundle') {
        throw new ConnectorError('Expected Bundle response', 'INVALID_RESPONSE');
      }

      // Yield each entry as a RawRecord
      for (const entry of bundle.entry ?? []) {
        if (entry.resource) {
          const resourceType =
            typeof entry.resource['resourceType'] === 'string'
              ? entry.resource['resourceType']
              : 'Unknown';

          yield {
            resourceType,
            data: entry.resource,
            source,
          };
        }
      }

      // Follow pagination link
      const nextLink = bundle.link?.find((l) => l.relation === 'next');
      nextUrl = nextLink?.url;
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.config = null;
  }

  /** Exchange client credentials for an OAuth2 access token */
  private async authenticate(config: FhirEndpointConfig): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      scope: config.scope ?? 'patient/*.read',
    });

    const response = await withRetry(async () => {
      const res = await fetch(config.tokenEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(config.timeout ?? 30000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from token endpoint`);
      }

      return res.json() as Promise<{ access_token: string }>;
    });

    // Inject token — stored in memory only, never logged
    (this.client as Record<string, unknown>)['bearer'] = response.access_token;
  }
}
