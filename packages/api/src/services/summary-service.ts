/**
 * Summary service — orchestrates deidentify → AI generation → format.
 * Uses in-memory Map store (MVP, TTL 10 min).
 * No PHI in logs — only hashed IDs and counts.
 */

import { randomUUID } from 'node:crypto';
import { ProviderGateway, formatMarkdown } from '@fhirbridge/core';
import type { Bundle, SummaryConfig, PatientSummary } from '@fhirbridge/types';

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

/** In-memory store with TTL eviction (10 minutes) */
const summaryStore = new Map<string, SummaryRecord>();
const STORE_TTL_MS = 10 * 60 * 1000;

function evictExpired(): void {
  const now = Date.now();
  for (const [key, record] of summaryStore.entries()) {
    if (now - record.createdAt > STORE_TTL_MS) summaryStore.delete(key);
  }
}

/** Resolve AI provider name to SummaryConfig-compatible provider name */
function resolveProvider(provider?: string): 'claude' | 'openai' {
  if (provider === 'openai') return 'openai';
  return 'claude';
}

/** Build a full SummaryConfig from partial options */
function buildSummaryConfig(options: SummaryRequestOptions = {}, hmacSecret: string): SummaryConfig {
  const providerName = resolveProvider(options.provider);
  const apiKey = providerName === 'openai'
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
  /** Start async summary generation. Returns summaryId immediately. */
  async startGeneration(request: SummaryRequest): Promise<string> {
    const summaryId = randomUUID();
    summaryStore.set(summaryId, { status: 'processing', createdAt: Date.now() });
    this.runGeneration(summaryId, request).catch(() => { /* stored in record */ });
    return summaryId;
  }

  /** Get current status of a summary job */
  getStatus(summaryId: string): SummaryRecord | undefined {
    evictExpired();
    return summaryStore.get(summaryId);
  }

  /** Internal: run the full AI pipeline */
  private async runGeneration(summaryId: string, request: SummaryRequest): Promise<void> {
    const record = summaryStore.get(summaryId)!;
    try {
      const config = buildSummaryConfig(request.summaryConfig, request.hmacSecret);
      const gateway = new ProviderGateway(config);
      const summary = await gateway.summarize(request.bundle, config);

      record.summary = summary;
      record.formattedMarkdown = formatMarkdown(summary);
      record.status = 'complete';
      summaryStore.set(summaryId, record);
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Summary generation failed';
      summaryStore.set(summaryId, record);
    }
  }
}
