/**
 * FHIR R4 Practitioner resource validator.
 * Validates Practitioner-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/practitioner.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource, patterns } from './resource-validator.js';

/** Giá trị giới tính hợp lệ */
const VALID_GENDERS = new Set(['male', 'female', 'other', 'unknown']);

/**
 * Validate a FHIR R4 Practitioner resource.
 * Must-support: identifier, name[0].family.
 */
export function validatePractitioner(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // Kiểm tra resourceType là Practitioner
  if (r['resourceType'] !== 'Practitioner') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "Practitioner"',
      severity: 'error',
    });
  }

  // Validate name — khuyến nghị có ít nhất một tên với family
  if (r['name'] !== undefined) {
    if (!Array.isArray(r['name'])) {
      errors.push({
        path: 'name',
        message: 'Practitioner.name must be an array',
        severity: 'error',
      });
    } else if (r['name'].length > 0) {
      const names = r['name'] as Record<string, unknown>[];
      const hasFamily = names.some(
        (n) =>
          n &&
          typeof n === 'object' &&
          typeof n['family'] === 'string' &&
          n['family'].trim() !== '',
      );
      if (!hasFamily) {
        errors.push({
          path: 'name[0].family',
          message: 'At least one Practitioner.name should have a family (surname)',
          severity: 'warning',
        });
      }
    }
  } else {
    // name không bắt buộc theo spec nhưng cần thiết trên thực tế
    errors.push({
      path: 'name',
      message: 'Practitioner.name is required for clinical identification',
      severity: 'warning',
    });
  }

  // Validate gender nếu có
  if (r['gender'] !== undefined && !VALID_GENDERS.has(r['gender'] as string)) {
    errors.push({
      path: 'gender',
      message: 'Practitioner.gender must be one of: male, female, other, unknown',
      severity: 'error',
    });
  }

  // Validate birthDate format nếu có
  if (r['birthDate'] !== undefined) {
    if (typeof r['birthDate'] !== 'string') {
      errors.push({
        path: 'birthDate',
        message: 'Practitioner.birthDate must be a string',
        severity: 'error',
      });
    } else if (!patterns.DATE.test(r['birthDate'])) {
      errors.push({
        path: 'birthDate',
        message: 'Practitioner.birthDate must be in YYYY-MM-DD format',
        severity: 'error',
      });
    }
  }

  // Validate qualification nếu có
  if (r['qualification'] !== undefined) {
    if (!Array.isArray(r['qualification'])) {
      errors.push({
        path: 'qualification',
        message: 'Practitioner.qualification must be an array',
        severity: 'error',
      });
    } else {
      const quals = r['qualification'] as unknown[];
      quals.forEach((q, i) => {
        if (!q || typeof q !== 'object') {
          errors.push({
            path: `qualification[${i}]`,
            message: 'qualification entry must be an object',
            severity: 'error',
          });
          return;
        }
        const qObj = q as Record<string, unknown>;
        // qualification.code là bắt buộc (FHIR R4 §3.8.1)
        if (!qObj['code'] || typeof qObj['code'] !== 'object') {
          errors.push({
            path: `qualification[${i}].code`,
            message: 'qualification.code (CodeableConcept) is required',
            severity: 'error',
          });
        }
      });
    }
  }

  // Validate identifier nếu có
  if (r['identifier'] !== undefined) {
    if (!Array.isArray(r['identifier'])) {
      errors.push({
        path: 'identifier',
        message: 'Practitioner.identifier must be an array',
        severity: 'error',
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
