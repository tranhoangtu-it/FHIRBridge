/**
 * Postgres-backed usage tracker for billing and analytics.
 * Writes to usage_tracking table (schema: docker/postgres/init.sql).
 * PRIVACY: only receives pre-hashed user IDs, no raw PHI.
 */

import { Pool } from 'pg';

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

export class PostgresUsageTracker {
  private readonly pool: Pool;
  private healthy = false;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });

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

  /**
   * Record a completed export for billing.
   * Fire-and-forget — never throws, logs errors internally.
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

  /** Get aggregated usage stats for a user in the given period */
  async getUsage(userIdHash: string, period: Period): Promise<UsageStats> {
    const since = PERIOD_SQL[period];
    try {
      const result = await this.pool.query<{
        total_exports: string;
        total_resources: string;
        avg_duration: string | null;
      }>(
        `SELECT
           COUNT(*)                   AS total_exports,
           COALESCE(SUM(resource_count), 0) AS total_resources,
           AVG(duration_ms)           AS avg_duration
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
      console.error('[PostgresUsageTracker] getUsage failed:', msg);
      this.healthy = false;
      return { totalExports: 0, totalResources: 0, avgDurationMs: null };
    }
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    await this.pool.end().catch((err: Error) => {
      console.error('[PostgresUsageTracker] pool end error:', err.message);
    });
  }
}
