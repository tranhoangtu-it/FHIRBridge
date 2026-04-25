/**
 * Postgres-backed usage tracker cho billing quota enforcement.
 *
 * Implements IUsageTracker từ @fhirbridge/core — drop-in thay thế cho
 * InMemoryUsageTracker với persistent storage, cross-restart và multi-replica safe.
 *
 * PRIVACY: chỉ nhận pre-hashed user IDs, không có raw PHI.
 *
 * Schema: bảng usage_tracking (docker/postgres/init.sql).
 * AI summary events được ghi với export_type = 'ai-summary' (sentinel value).
 * SCHEMA NOTE: Nếu muốn tách biệt hơn, có thể thêm cột event_type VARCHAR(20)
 * vào usage_tracking với migration ALTER TABLE usage_tracking ADD COLUMN event_type VARCHAR(20) DEFAULT 'export'.
 * Hiện tại dùng sentinel trong export_type để không cần migration.
 *
 * PRODUCTION NOTE: Nếu DATABASE_URL không set, bootstrap/index.ts fallback về
 * InMemoryUsageTracker (per-pod, không persistent, không multi-replica safe).
 */

import type { IUsageTracker } from '@fhirbridge/core';
import type { UsageRecord } from '@fhirbridge/types';
import { Pool } from 'pg';
import { currentPeriod } from '@fhirbridge/core';

// Sentinel export_type dùng để đánh dấu AI summary events trong usage_tracking
const AI_SUMMARY_TYPE = 'ai-summary';

// Default resource_count và duration_ms cho recordExport/recordSummary (không có context)
const DEFAULT_RESOURCE_COUNT = 0;
const DEFAULT_DURATION_MS = 0;
const DEFAULT_TIER = 'unknown';

export interface UsageStats {
  totalExports: number;
  totalResources: number;
  avgDurationMs: number | null;
}

type ExportType = 'fhir-json' | 'fhir-ndjson' | 'csv' | 'pdf';
type Period = 'day' | 'week' | 'month';

const PERIOD_SQL: Record<Period, string> = {
  day: "NOW() - INTERVAL '1 day'",
  week: "NOW() - INTERVAL '7 days'",
  month: "NOW() - INTERVAL '30 days'",
};

export class PostgresUsageTracker implements IUsageTracker {
  private readonly pool: Pool;
  private healthy = false;

  constructor(databaseUrlOrPool: string | Pool) {
    if (typeof databaseUrlOrPool === 'string') {
      this.pool = new Pool({
        connectionString: databaseUrlOrPool,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 3_000,
      });
    } else {
      // DI: nhận Pool instance trực tiếp (testing hoặc shared pool)
      this.pool = databaseUrlOrPool;
    }

    this.pool.on('error', (err) => {
      console.error('[PostgresUsageTracker] pool error:', err.message);
      this.healthy = false;
    });

    this.pool
      .query('SELECT 1')
      .then(() => {
        this.healthy = true;
      })
      .catch((err: Error) => {
        console.error('[PostgresUsageTracker] initial connection check failed:', err.message);
      });
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  // ── IUsageTracker interface methods ──────────────────────────────────────────

  /**
   * Ghi nhận 1 export event cho user trong billing period hiện tại.
   * Fire-and-forget — không bao giờ throw, ghi error vào console.
   */
  recordExport(userId: string): Promise<void> {
    return this.insertUsageEvent(userId, 'export');
  }

  /**
   * Ghi nhận 1 AI summary event cho user trong billing period hiện tại.
   * Fire-and-forget — không bao giờ throw, ghi error vào console.
   */
  recordSummary(userId: string): Promise<void> {
    return this.insertUsageEvent(userId, AI_SUMMARY_TYPE);
  }

  /**
   * Lấy usage stats cho user trong billing period chỉ định.
   * period format: YYYY-MM (e.g. '2025-01'). Mặc định là tháng hiện tại.
   * Không bao giờ throw — trả về zero stats nếu DB lỗi.
   */
  async getUsage(userId: string, period?: string): Promise<UsageRecord> {
    const targetPeriod = period ?? currentPeriod();
    // Tính period start: ngày đầu tháng 00:00:00 UTC
    const periodStart = this.periodToStartDate(targetPeriod);

    try {
      const result = await this.pool.query<{
        export_count: string;
        summary_count: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE export_type != $3) AS export_count,
           COUNT(*) FILTER (WHERE export_type = $3)  AS summary_count
         FROM usage_tracking
         WHERE user_id_hash = $1
           AND timestamp >= $2`,
        [userId, periodStart, AI_SUMMARY_TYPE],
      );

      this.healthy = true;
      const row = result.rows[0];
      if (!row) {
        return this.zeroRecord(userId, targetPeriod);
      }

      return {
        userId,
        period: targetPeriod,
        exportCount: parseInt(row.export_count, 10) || 0,
        aiSummaryCount: parseInt(row.summary_count, 10) || 0,
        totalCostCents: 0, // Cost computation là trách nhiệm của BillingService, không của tracker
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PostgresUsageTracker] getUsage failed:', msg);
      this.healthy = false;
      return this.zeroRecord(userId, targetPeriod);
    }
  }

  /**
   * Xóa usage records của user trong billing period hiện tại.
   * Dùng cho testing hoặc admin reset — không bao giờ throw.
   */
  async resetPeriod(userId: string): Promise<void> {
    const periodStart = this.periodToStartDate(currentPeriod());
    try {
      await this.pool.query(
        `DELETE FROM usage_tracking WHERE user_id_hash = $1 AND timestamp >= $2`,
        [userId, periodStart],
      );
      this.healthy = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PostgresUsageTracker] resetPeriod failed:', msg);
      this.healthy = false;
    }
  }

  // ── Legacy methods (backward-compat với callers đang dùng trackExport / getUsage(Period)) ──

  /**
   * Ghi nhận một export hoàn chỉnh với metadata chi tiết (analytics).
   * Backward-compat với callers cũ dùng rich export tracking.
   * Fire-and-forget — không bao giờ throw.
   */
  trackExport(
    userIdHash: string,
    exportType: ExportType,
    resourceCount: number,
    durationMs: number,
    tier: string,
  ): void {
    this.pool
      .query(
        `INSERT INTO usage_tracking (user_id_hash, export_type, resource_count, duration_ms, tier)
         VALUES ($1, $2, $3, $4, $5)`,
        [userIdHash, exportType, resourceCount, durationMs, tier],
      )
      .then(() => {
        this.healthy = true;
      })
      .catch((err: Error) => {
        console.error('[PostgresUsageTracker] trackExport failed:', err.message);
        this.healthy = false;
      });
  }

  /**
   * Lấy aggregated usage stats theo period window (day/week/month).
   * Backward-compat — trả về UsageStats (khác với IUsageTracker.getUsage → UsageRecord).
   * Dùng overload name getUsageStats để tránh ambiguity.
   */
  async getUsageStats(userIdHash: string, period: Period): Promise<UsageStats> {
    const since = PERIOD_SQL[period];
    try {
      const result = await this.pool.query<{
        total_exports: string;
        total_resources: string;
        avg_duration: string | null;
      }>(
        `SELECT
           COUNT(*)                             AS total_exports,
           COALESCE(SUM(resource_count), 0)     AS total_resources,
           AVG(duration_ms)                     AS avg_duration
         FROM usage_tracking
         WHERE user_id_hash = $1
           AND timestamp >= ${since}`,
        [userIdHash],
      );

      const row = result.rows[0];
      if (!row) return { totalExports: 0, totalResources: 0, avgDurationMs: null };

      this.healthy = true;
      return {
        totalExports: parseInt(row.total_exports, 10) || 0,
        totalResources: parseInt(row.total_resources, 10) || 0,
        avgDurationMs: row.avg_duration !== null ? parseFloat(row.avg_duration) : null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PostgresUsageTracker] getUsageStats failed:', msg);
      this.healthy = false;
      return { totalExports: 0, totalResources: 0, avgDurationMs: null };
    }
  }

  /** Graceful shutdown — đóng pool connections */
  async shutdown(): Promise<void> {
    await this.pool.end().catch((err: Error) => {
      console.error('[PostgresUsageTracker] pool end error:', err.message);
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Insert 1 event vào usage_tracking với default analytics values */
  private async insertUsageEvent(userId: string, eventType: string): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO usage_tracking (user_id_hash, export_type, resource_count, duration_ms, tier)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, eventType, DEFAULT_RESOURCE_COUNT, DEFAULT_DURATION_MS, DEFAULT_TIER],
      );
      this.healthy = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[PostgresUsageTracker] insertUsageEvent(${eventType}) failed:`, msg);
      this.healthy = false;
    }
  }

  /**
   * Chuyển YYYY-MM period string thành Date đầu tháng (00:00:00 UTC).
   * Fallback về đầu tháng hiện tại nếu format sai.
   */
  private periodToStartDate(period: string): Date {
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) {
      // Fallback: đầu tháng hiện tại
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    return new Date(Date.UTC(year, month, 1));
  }

  /** Trả về UsageRecord zero-value */
  private zeroRecord(userId: string, period: string): UsageRecord {
    return { userId, period, exportCount: 0, aiSummaryCount: 0, totalCostCents: 0 };
  }
}
