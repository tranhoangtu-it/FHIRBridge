/**
 * Audit service — write audit log entries.
 * Console-based implementation (MVP). Interface supports swapping to Postgres.
 * PRIVACY: only receives pre-hashed user IDs, no raw PHI.
 */

import type { AuditLogEntry } from '@fhirbridge/types';

/** Minimal audit payload (action is route path or action name) */
export interface AuditPayload {
  userIdHash: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  resourceCount?: number;
  metadata?: Record<string, unknown>;
}

/** Sink interface — swap console for Postgres without changing callers */
export interface AuditSink {
  write(entry: AuditLogEntry): Promise<void>;
}

/** Console-based audit sink (default for MVP) */
export class ConsoleAuditSink implements AuditSink {
  async write(entry: AuditLogEntry): Promise<void> {
    // Use structured logging, no PHI in output
    const line = JSON.stringify({
      audit: true,
      ts: entry.timestamp,
      user: entry.userIdHash,
      action: entry.action,
      status: entry.status,
      resources: entry.resourceCount,
      meta: entry.metadata,
    });
    process.stdout.write(line + '\n');
  }
}

/** Audit service — wraps sink with timestamp injection */
export class AuditService {
  constructor(private readonly sink: AuditSink = new ConsoleAuditSink()) {}

  async log(payload: AuditPayload): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userIdHash: payload.userIdHash,
      action: payload.action as AuditLogEntry['action'],
      status: payload.status,
      resourceCount: payload.resourceCount,
      metadata: payload.metadata,
    };
    await this.sink.write(entry);
  }
}
