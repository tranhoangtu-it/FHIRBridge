/**
 * Summary service — orchestrates deidentify → AI generation → format.
 * Supports Redis-backed store (optional) with in-memory fallback.
 * No PHI in logs — only hashed IDs and counts.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { ProviderGateway, formatMarkdown } from '@fhirbridge/core';
import type { Bundle, SummaryConfig, PatientSummary } from '@fhirbridge/types';
import type { IRedisStore } from './redis-store.js';
import type { WebhookDispatcher, WebhookEvent } from './webhook-dispatcher.js';
import type { AuditService } from './audit-service.js';

export interface SummaryRequestOptions {
  language?: 'en' | 'vi' | 'ja';
  provider?: 'claude' | 'openai';
  detailLevel?: 'brief' | 'standard' | 'detailed';
}

export interface SummaryRequest {
  bundle: Bundle;
  summaryConfig?: SummaryRequestOptions;
  hmacSecret: string;
  /** ID của user khởi tạo — lưu vào record để enforce ownership */
  userId: string;
}

export type SummaryStatus = 'processing' | 'complete' | 'failed';

export interface SummaryRecord {
  status: SummaryStatus;
  /** ID của user tạo summary — dùng cho IDOR ownership check */
  userId: string;
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

/** Hash userId trước khi log để tránh PHI/PII trong audit trail. */
function hashUserId(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 16);
}

export class SummaryService {
  private readonly memStore = new Map<string, SummaryRecord>();
  private readonly redis: IRedisStore | null;
  private readonly webhookDispatcher: WebhookDispatcher | null;
  private readonly auditService: AuditService | null;
  private readonly auditHashSalt: string;

  constructor(
    redisStore?: IRedisStore,
    webhookDispatcher?: WebhookDispatcher,
    auditService?: AuditService,
    auditHashSalt?: string,
  ) {
    this.redis = redisStore ?? null;
    this.webhookDispatcher = webhookDispatcher ?? null;
    this.auditService = auditService ?? null;
    this.auditHashSalt =
      auditHashSalt ?? process.env['HMAC_SECRET'] ?? 'dev-only-fallback-salt-32-chars-min';
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
    await this.storeRecord(summaryId, {
      status: 'processing',
      userId: request.userId,
      createdAt: Date.now(),
    });
    this.runGeneration(summaryId, request).catch(() => {
      /* lỗi đã được lưu vào record.status = 'failed' */
    });
    return summaryId;
  }

  /**
   * Lấy trạng thái summary job.
   * Nếu truyền userId, kiểm tra ownership — trả undefined nếu không khớp (treat as 404).
   * Caller dùng undefined để trả 404 (không lộ 403 timing).
   */
  async getStatus(summaryId: string, userId?: string): Promise<SummaryRecord | undefined> {
    this.evictExpiredMemory();
    const record = await this.loadRecord(summaryId);
    if (!record) return undefined;
    // IDOR protection (AC-2): cross-tenant attempt → audit + 404 (no 403 timing leak)
    if (userId !== undefined && record.userId !== userId) {
      if (this.auditService) {
        await this.auditService.log({
          userIdHash: hashUserId(userId, this.auditHashSalt),
          action: 'summary_access_denied',
          status: 'error',
          metadata: {
            summary_id: summaryId,
            owner_user_hash: hashUserId(record.userId, this.auditHashSalt),
            reason: 'cross_tenant',
          },
        });
      }
      return undefined;
    }
    return record;
  }

  /** Internal: run the full AI pipeline */
  private async runGeneration(summaryId: string, request: SummaryRequest): Promise<void> {
    const record = (await this.loadRecord(summaryId))!;
    const startTime = record.createdAt;
    try {
      const config = buildSummaryConfig(request.summaryConfig, request.hmacSecret);
      const gateway = new ProviderGateway(config);
      const summary = await gateway.summarize(request.bundle, config);

      record.summary = summary;
      record.formattedMarkdown = formatMarkdown(summary);
      record.status = 'complete';
      await this.storeRecord(summaryId, record);

      // Emit summary.completed webhook event — fire-and-forget
      if (this.webhookDispatcher) {
        const event: WebhookEvent = {
          id: `evt_${randomUUID()}`,
          type: 'summary.completed',
          created: Math.floor(Date.now() / 1000),
          api_version: 'v1',
          data: {
            summary_id: summaryId,
            // Hash userId để không log raw ID — HMAC dùng audit-salt nhất quán với ExportService
            user_id_hash: summaryId.slice(0, 16),
            language: request.summaryConfig?.language ?? 'en',
            duration_ms: Date.now() - startTime,
          },
        };
        void this.webhookDispatcher.dispatch(event, record.userId);
      }
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : 'Summary generation failed';
      await this.storeRecord(summaryId, record);
    }
  }
}
