/**
 * FHIR R4 CarePlan resource validator.
 * Validates CarePlan-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/careplan.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho CarePlan.status (FHIR R4 §11.4.1.2) */
const VALID_STATUSES = new Set([
  'draft',
  'active',
  'on-hold',
  'revoked',
  'completed',
  'entered-in-error',
  'unknown',
]);

/** Giá trị hợp lệ cho CarePlan.intent (FHIR R4 §11.4.1.3) */
const VALID_INTENTS = new Set(['proposal', 'plan', 'order', 'option', 'directive']);

/** Giá trị hợp lệ cho CarePlan.activity[].detail.status */
const VALID_ACTIVITY_STATUSES = new Set([
  'not-started',
  'scheduled',
  'in-progress',
  'on-hold',
  'completed',
  'cancelled',
  'stopped',
  'unknown',
  'entered-in-error',
]);

/**
 * Validate a FHIR R4 CarePlan resource.
 * Required: status, intent, subject.
 */
export function validateCarePlan(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // Kiểm tra resourceType
  if (r['resourceType'] !== 'CarePlan') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "CarePlan"',
      severity: 'error',
    });
  }

  // Kiểm tra status — bắt buộc
  if (r['status'] === undefined || r['status'] === null) {
    errors.push({
      path: 'status',
      message: 'CarePlan.status is required',
      severity: 'error',
    });
  } else if (!VALID_STATUSES.has(r['status'] as string)) {
    errors.push({
      path: 'status',
      message:
        'CarePlan.status must be one of: draft, active, on-hold, revoked, completed, entered-in-error, unknown',
      severity: 'error',
    });
  }

  // Kiểm tra intent — bắt buộc
  if (r['intent'] === undefined || r['intent'] === null) {
    errors.push({
      path: 'intent',
      message: 'CarePlan.intent is required',
      severity: 'error',
    });
  } else if (!VALID_INTENTS.has(r['intent'] as string)) {
    errors.push({
      path: 'intent',
      message: 'CarePlan.intent must be one of: proposal, plan, order, option, directive',
      severity: 'error',
    });
  }

  // Kiểm tra subject — bắt buộc
  if (r['subject'] === undefined || r['subject'] === null) {
    errors.push({
      path: 'subject',
      message: 'CarePlan.subject is required',
      severity: 'error',
    });
  } else if (typeof r['subject'] !== 'object' || Array.isArray(r['subject'])) {
    errors.push({
      path: 'subject',
      message: 'CarePlan.subject must be a Reference object',
      severity: 'error',
    });
  } else {
    const subj = r['subject'] as Record<string, unknown>;
    if (!subj['reference'] && !subj['identifier']) {
      errors.push({
        path: 'subject',
        message: 'CarePlan.subject must have a reference or identifier',
        severity: 'error',
      });
    }
  }

  // Kiểm tra activity nếu có
  if (r['activity'] !== undefined) {
    if (!Array.isArray(r['activity'])) {
      errors.push({
        path: 'activity',
        message: 'CarePlan.activity must be an array',
        severity: 'error',
      });
    } else {
      const activities = r['activity'] as unknown[];
      activities.forEach((act, i) => {
        if (!act || typeof act !== 'object') {
          errors.push({
            path: `activity[${i}]`,
            message: 'activity entry must be an object',
            severity: 'error',
          });
          return;
        }
        const actObj = act as Record<string, unknown>;
        // Nếu có detail, kiểm tra detail.status là bắt buộc
        if (actObj['detail'] !== undefined) {
          if (typeof actObj['detail'] !== 'object' || Array.isArray(actObj['detail'])) {
            errors.push({
              path: `activity[${i}].detail`,
              message: 'activity.detail must be an object',
              severity: 'error',
            });
          } else {
            const detail = actObj['detail'] as Record<string, unknown>;
            if (!detail['status']) {
              errors.push({
                path: `activity[${i}].detail.status`,
                message: 'activity.detail.status is required',
                severity: 'error',
              });
            } else if (!VALID_ACTIVITY_STATUSES.has(detail['status'] as string)) {
              errors.push({
                path: `activity[${i}].detail.status`,
                message: `activity.detail.status must be one of: ${[...VALID_ACTIVITY_STATUSES].join(', ')}`,
                severity: 'error',
              });
            }
          }
        }
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
