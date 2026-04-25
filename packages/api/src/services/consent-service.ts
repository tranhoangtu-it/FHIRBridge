/**
 * ConsentService — ghi consent record vào audit log.
 *
 * PRIVACY:
 *  - Nhận userIdHash đã được hash trước (không bao giờ nhận raw userId)
 *  - metadata chỉ chứa consentType và versionHash — không chứa PHI
 */

import { createHash } from 'node:crypto';
import type { AuditSink } from './audit-service.js';

export interface RecordConsentParams {
  /** Raw user ID từ JWT/API key — sẽ được hash SHA-256 trong service */
  userId: string;
  consentType: 'crossborder_ai';
  consentVersionHash: string;
  granted: boolean;
}

export class ConsentService {
  constructor(private readonly auditSink: AuditSink) {}

  /**
   * Ghi một consent event vào audit log.
   * action = 'consent_grant' nếu granted=true, 'consent_revoke' nếu false.
   */
  async recordConsent(params: RecordConsentParams): Promise<void> {
    const { userId, consentType, consentVersionHash, granted } = params;

    // Hash userId trước khi ghi — không lưu raw user ID
    const userIdHash = createHash('sha256').update(userId, 'utf8').digest('hex');

    await this.auditSink.write({
      timestamp: new Date().toISOString(),
      userIdHash,
      action: granted ? 'consent_grant' : 'consent_revoke',
      status: 'success',
      metadata: {
        consentType,
        versionHash: consentVersionHash,
      },
    });
  }
}
