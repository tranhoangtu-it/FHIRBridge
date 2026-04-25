/**
 * FHIR R4 Medication resource validator.
 * Validates Medication-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/medication.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho Medication.status */
const VALID_STATUSES = new Set(['active', 'inactive', 'entered-in-error']);

/**
 * URL hệ thống mã thuốc được hỗ trợ.
 * RxNorm là tiêu chuẩn US; SNOMED CT cho tên chung quốc tế.
 */
const SUPPORTED_MED_SYSTEMS = new Set([
  'http://www.nlm.nih.gov/research/umls/rxnorm',
  'http://snomed.info/sct',
  'urn:oid:2.16.840.1.113883.6.88', // RxNorm OID
]);

/**
 * Validate a FHIR R4 Medication resource.
 * Required for clinical use: code with at least text or coding.
 */
export function validateMedication(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // Kiểm tra resourceType là Medication
  if (r['resourceType'] !== 'Medication') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "Medication"',
      severity: 'error',
    });
  }

  // Kiểm tra code — must-support, cần ít nhất text hoặc coding
  if (r['code'] === undefined || r['code'] === null) {
    errors.push({
      path: 'code',
      message: 'Medication.code is required for identification',
      severity: 'error',
    });
  } else if (typeof r['code'] !== 'object' || Array.isArray(r['code'])) {
    errors.push({
      path: 'code',
      message: 'Medication.code must be a CodeableConcept object',
      severity: 'error',
    });
  } else {
    const code = r['code'] as Record<string, unknown>;
    const hasCoding = Array.isArray(code['coding']) && code['coding'].length > 0;
    const hasText = typeof code['text'] === 'string' && code['text'].trim() !== '';

    if (!hasCoding && !hasText) {
      errors.push({
        path: 'code',
        message: 'Medication.code must have at least one coding or a text value',
        severity: 'error',
      });
    }

    // Khuyến nghị dùng RxNorm hoặc SNOMED CT
    if (hasCoding) {
      const codings = code['coding'] as Record<string, unknown>[];
      const hasKnownSystem = codings.some(
        (c) => c && typeof c['system'] === 'string' && SUPPORTED_MED_SYSTEMS.has(c['system']),
      );
      if (!hasKnownSystem) {
        errors.push({
          path: 'code.coding[].system',
          message: 'Medication.code.coding should use RxNorm or SNOMED CT system',
          severity: 'warning',
        });
      }
    }
  }

  // Kiểm tra status nếu có
  if (r['status'] !== undefined) {
    if (!VALID_STATUSES.has(r['status'] as string)) {
      errors.push({
        path: 'status',
        message: 'Medication.status must be one of: active, inactive, entered-in-error',
        severity: 'error',
      });
    }
  }

  // Kiểm tra ingredient nếu có
  if (r['ingredient'] !== undefined) {
    if (!Array.isArray(r['ingredient'])) {
      errors.push({
        path: 'ingredient',
        message: 'Medication.ingredient must be an array',
        severity: 'error',
      });
    } else {
      const ingredients = r['ingredient'] as unknown[];
      ingredients.forEach((ing, i) => {
        if (!ing || typeof ing !== 'object') {
          errors.push({
            path: `ingredient[${i}]`,
            message: 'Each ingredient must be an object',
            severity: 'error',
          });
          return;
        }
        const ingObj = ing as Record<string, unknown>;
        // Mỗi ingredient cần itemCodeableConcept hoặc itemReference
        const hasItem =
          ingObj['itemCodeableConcept'] !== undefined || ingObj['itemReference'] !== undefined;
        if (!hasItem) {
          errors.push({
            path: `ingredient[${i}]`,
            message: 'ingredient must have itemCodeableConcept or itemReference',
            severity: 'error',
          });
        }
      });
    }
  }

  // Kiểm tra batch nếu có
  if (r['batch'] !== undefined) {
    if (typeof r['batch'] !== 'object' || Array.isArray(r['batch']) || r['batch'] === null) {
      errors.push({
        path: 'batch',
        message: 'Medication.batch must be an object',
        severity: 'error',
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
