/**
 * FHIR R4 CareTeam resource validator.
 * Validates CareTeam-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/careteam.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho CareTeam.status (FHIR R4 §12.15.1.2) */
const VALID_STATUSES = new Set(['proposed', 'active', 'suspended', 'inactive', 'entered-in-error']);

/**
 * Validate a FHIR R4 CareTeam resource.
 * Must-support: status, subject, participant[].member.
 */
export function validateCareTeam(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // Kiểm tra resourceType
  if (r['resourceType'] !== 'CareTeam') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "CareTeam"',
      severity: 'error',
    });
  }

  // Kiểm tra status nếu có — enum validation
  if (r['status'] !== undefined && !VALID_STATUSES.has(r['status'] as string)) {
    errors.push({
      path: 'status',
      message:
        'CareTeam.status must be one of: proposed, active, suspended, inactive, entered-in-error',
      severity: 'error',
    });
  }

  // Khuyến nghị có subject
  if (r['subject'] === undefined || r['subject'] === null) {
    errors.push({
      path: 'subject',
      message: 'CareTeam.subject is required for patient-context care teams',
      severity: 'warning',
    });
  } else if (typeof r['subject'] !== 'object' || Array.isArray(r['subject'])) {
    errors.push({
      path: 'subject',
      message: 'CareTeam.subject must be a Reference object',
      severity: 'error',
    });
  }

  // Khuyến nghị có participant
  if (r['participant'] === undefined || r['participant'] === null) {
    errors.push({
      path: 'participant',
      message: 'CareTeam.participant is required for a meaningful care team',
      severity: 'warning',
    });
  } else if (!Array.isArray(r['participant'])) {
    errors.push({
      path: 'participant',
      message: 'CareTeam.participant must be an array',
      severity: 'error',
    });
  } else {
    const participants = r['participant'] as unknown[];
    participants.forEach((p, i) => {
      if (!p || typeof p !== 'object') {
        errors.push({
          path: `participant[${i}]`,
          message: 'participant entry must be an object',
          severity: 'error',
        });
        return;
      }
      const pObj = p as Record<string, unknown>;

      // Mỗi participant nên có member (Practitioner, Patient, Organization, v.v.)
      if (!pObj['member']) {
        errors.push({
          path: `participant[${i}].member`,
          message: 'participant.member is required to identify the care team member',
          severity: 'warning',
        });
      }

      // Nếu có role, phải là mảng CodeableConcept
      if (pObj['role'] !== undefined && !Array.isArray(pObj['role'])) {
        errors.push({
          path: `participant[${i}].role`,
          message: 'participant.role must be an array of CodeableConcept',
          severity: 'error',
        });
      }
    });
  }

  // Validate name nếu có
  if (r['name'] !== undefined && typeof r['name'] !== 'string') {
    errors.push({
      path: 'name',
      message: 'CareTeam.name must be a string',
      severity: 'error',
    });
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
