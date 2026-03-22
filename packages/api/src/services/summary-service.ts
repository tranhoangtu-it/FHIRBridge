/**
 * Summary service — orchestrates deidentify → AI generation → format.
 * Supports Redis-backed store (optional) with in-memory fallback.
 * No PHI in logs — only hashed IDs and counts.
 */

import { randomUUID } from 'node:crypto';
import { ProviderGateway, formatMarkdown } from '@fhirbridge/core';
import type { Bundle, SummaryConfig, PatientSummary } from '@fhirbridge/types';
import type { IRedisStore } from './redis-store.js';

export interface SummaryRequestOptions {
  language?: 'en' | 'vi' | 'ja';
  provider?: 'claude' | 'openai';
  detailLevel?: 'brief' | 'standard' | 'detailed';
}

export interface SummaryRequest {
  bundle: Bundle;
  summaryConfig?: SummaryRequestOptions;
  hmacSecret: string;
}

export type SummaryStatus = 'processing' | 'complete' | 'failed';

export interface SummaryRecord {
  status: SummaryStatus;
  summary?: PatientSummary;
  formattedMarkdown?: string;
  error?: string;
  createdAt: number;
}

/** TTL for summary records: 10 minutes */
const SUMMARY_TTL_SECONDS = 10 * 60;
const STORE_TTL_MS = SUMMARY_TTL_SECONDS * 1000;

/** Resolve AI provider name to SummaryConfig-compatible provider name */
function resolveProvider(provider?: string): 'claude' | 'openai' {
  if (provider === 'openai') return 'openai';
  return 'claude';
}

/** Build a full SummaryConfig from partial options */
function buildSummaryConfig(
  options: SummaryRequestOptions = {},
  hmacSecret: string,
): SummaryConfig {
  const providerName = resolveProvider(options.provider);
  const apiKey =
    providerName === 'openai'
      ? (process.env['OPENAI_API_KEY'] ?? '')
      : (process.env['ANTHROPIC_API_KEY'] ?? '');

  return {
    language: options.language ?? 'en',
    detailLevel: options.detailLevel ?? 'standard',
    outputFormats: ['markdown'],
    hmacSecret,
    providerConfig: {
      provider: providerName,
      model: providerName === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514',
      apiKey,
      maxTokens: 2048,
      temperature: 0.3,
      timeoutMs: 30000,
    },
  };
}

export class SummaryService {
  private readonly memStore = new Map<string, SummaryRecord>();
  private readonly redis: IRedisStore | null;

  constructor(redisStore?: IRedisStore) {
    this.redis = redisStore ?? null;
  }

  private async storeRecord(summaryId: string, record: SummaryRecord): Promise<void> {
    if (this.redis) {
      await this.redis.set(summaryId, record, SUMMARY_TTL_SECONDS);
    } else {
      this.memStore.set(summaryId, record);
    }
  }

  private async loadRecord(summaryId: string): Promise<SummaryRecord | undefined> {
    if (this.redis) {
      return this.redis.get<SummaryRecord>(summaryId);
    }
    return this.memStore.get(summaryId);
  }

  private evictExpiredMemory(): void {
    const now = Date.now();
    for (const [key, record] of this.memStore.entries()) {
      if (now - record.createdAt > STORE_TTL_MS) this.memStore.delete(key);
    }
  }

  /** Start async summary generation. Returns summaryId immediately. */
  async startGeneration(request: SummaryRequest): Promise<string> {
    const summaryId = randomUUID();
    await this.storeRecord(summaryId, { status: 'processing', createdAt: Date.now() });
    this.runGeneration(summaryId, request).catch(() => {
      /* stored in record */
    });
    return summaryId;
  }

  /** Get current status of a summary job */
  async getStatus(summaryId: string): Promise<SummaryRecord | undefined> {
    this.evictExpiredMemory();
    return this.loadRecord(summaryId);
  }

  /** Internal: run the full AI pipeline */
  private async runGeneration(summaryId: string, request: SummaryRequest): Promise<void> {
    const record = (await this.loadRecord(summaryId))!;
    try {
      const config = buildSummaryConfig(request.summaryConfig, request.hmacSecret);
      const gateway = new ProviderGateway(config);
      const summary = await gateway.summarize(request.bundle, config);

      record.summary = summary;
      record.formattedMarkdown = formatMarkdown(summary);
      record.status = 'complete';
      await this.storeRecord(summaryId, record);
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Summary generation failed';
      await this.storeRecord(summaryId, record);
    }
  }
}
