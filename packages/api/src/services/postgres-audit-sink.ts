/**
 * Postgres-backed AuditSink — batches writes for efficiency.
 * Implements the AuditSink interface from audit-service.ts.
 * PRIVACY: only receives pre-hashed user IDs, no raw PHI.
 */

import { Pool } from 'pg';
import type { AuditLogEntry } from '@fhirbridge/types';
import type { AuditSink } from './audit-service.js';

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 50;

export class PostgresAuditSink implements AuditSink {
  private readonly pool: Pool;
  private readonly pending: AuditLogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private healthy = false;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgresAuditSink] pool error:', err.message);
      this.healthy = false;
    });

    // Probe connection on startup
    this.pool
      .query('SELECT 1')
      .then(() => {
        this.healthy = true;
      })
      .catch((err: Error) => {
        console.error('[PostgresAuditSink] initial connection check failed:', err.message);
      });

    this.flushTimer = setInterval(() => {
      this.flush().catch((err: Error) => {
        console.error('[PostgresAuditSink] scheduled flush failed:', err.message);
      });
    }, FLUSH_INTERVAL_MS);

    // Allow process to exit — unref the timer
    this.flushTimer.unref();
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  /** Collect entry for batched write — never blocks caller */
  async write(entry: AuditLogEntry): Promise<void> {
    this.pending.push(entry);
    if (this.pending.length >= FLUSH_BATCH_SIZE) {
      this.flush().catch((err: Error) => {
        console.error('[PostgresAuditSink] batch flush failed:', err.message);
      });
    }
  }

  /** Flush all pending entries to Postgres */
  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0, this.pending.length);

    const client = await this.pool.connect().catch((err: Error) => {
      console.error('[PostgresAuditSink] flush: connect failed:', err.message);
      // Re-queue entries that could not be written
      this.pending.unshift(...batch);
      return null;
    });
    if (!client) return;

    try {
      this.healthy = true;
      const values: unknown[] = [];
      const placeholders = batch.map((entry, i) => {
        const base = i * 6;
        values.push(
          entry.timestamp,
          entry.userIdHash,
          entry.action,
          entry.status,
          entry.resourceCount ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb)`;
      });

      await client.query(
        `INSERT INTO audit_logs (timestamp, user_id_hash, action, status, resource_count, metadata)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PostgresAuditSink] INSERT failed:', msg);
      this.healthy = false;
    } finally {
      client.release();
    }
  }

  /** Graceful shutdown — flush remaining entries and close pool */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    await this.pool.end().catch((err: Error) => {
      console.error('[PostgresAuditSink] pool end error:', err.message);
    });
  }
}
