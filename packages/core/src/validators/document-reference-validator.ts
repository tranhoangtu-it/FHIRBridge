/**
 * FHIR R4 DocumentReference resource validator.
 * Validates DocumentReference-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/documentreference.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho DocumentReference.status */
const VALID_STATUSES = new Set(['current', 'superseded', 'entered-in-error']);

/** Giá trị hợp lệ cho DocumentReference.docStatus */
const VALID_DOC_STATUSES = new Set(['preliminary', 'final', 'amended', 'entered-in-error']);

/**
 * LOINC codes phổ biến cho loại tài liệu lâm sàng.
 * Nguồn: https://loinc.org/clinical-document-ontology/
 * Ví dụ: 18842-5 (Discharge summary), 11502-2 (Lab report), 34117-2 (History & physical)
 */
const LOINC_SYSTEM = 'http://loinc.org';

/**
 * Validate a FHIR R4 DocumentReference resource.
 * Required: status, content[].attachment.
 */
export function validateDocumentReference(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // Kiểm tra resourceType
  if (r['resourceType'] !== 'DocumentReference') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "DocumentReference"',
      severity: 'error',
    });
  }

  // Kiểm tra status — bắt buộc
  if (r['status'] === undefined || r['status'] === null) {
    errors.push({
      path: 'status',
      message: 'DocumentReference.status is required',
      severity: 'error',
    });
  } else if (!VALID_STATUSES.has(r['status'] as string)) {
    errors.push({
      path: 'status',
      message: 'DocumentReference.status must be one of: current, superseded, entered-in-error',
      severity: 'error',
    });
  }

  // Kiểm tra docStatus nếu có
  if (r['docStatus'] !== undefined && !VALID_DOC_STATUSES.has(r['docStatus'] as string)) {
    errors.push({
      path: 'docStatus',
      message:
        'DocumentReference.docStatus must be one of: preliminary, final, amended, entered-in-error',
      severity: 'error',
    });
  }

  // Kiểm tra type nếu có — khuyến nghị dùng LOINC
  if (r['type'] !== undefined) {
    if (typeof r['type'] !== 'object' || Array.isArray(r['type']) || r['type'] === null) {
      errors.push({
        path: 'type',
        message: 'DocumentReference.type must be a CodeableConcept object',
        severity: 'error',
      });
    } else {
      const typeObj = r['type'] as Record<string, unknown>;
      if (Array.isArray(typeObj['coding'])) {
        const codings = typeObj['coding'] as Record<string, unknown>[];
        const hasLoinc = codings.some((c) => c && c['system'] === LOINC_SYSTEM);
        if (!hasLoinc) {
          errors.push({
            path: 'type.coding[].system',
            message: 'DocumentReference.type.coding should use LOINC system (http://loinc.org)',
            severity: 'warning',
          });
        }
      }
    }
  }

  // Kiểm tra content — bắt buộc, ít nhất một phần tử
  if (r['content'] === undefined || r['content'] === null) {
    errors.push({
      path: 'content',
      message: 'DocumentReference.content is required',
      severity: 'error',
    });
  } else if (!Array.isArray(r['content'])) {
    errors.push({
      path: 'content',
      message: 'DocumentReference.content must be an array',
      severity: 'error',
    });
  } else if (r['content'].length === 0) {
    errors.push({
      path: 'content',
      message: 'DocumentReference.content must have at least one entry',
      severity: 'error',
    });
  } else {
    const contents = r['content'] as unknown[];
    contents.forEach((c, i) => {
      if (!c || typeof c !== 'object') {
        errors.push({
          path: `content[${i}]`,
          message: 'content entry must be an object',
          severity: 'error',
        });
        return;
      }
      const cObj = c as Record<string, unknown>;
      // attachment là bắt buộc trong mỗi content entry
      if (!cObj['attachment'] || typeof cObj['attachment'] !== 'object') {
        errors.push({
          path: `content[${i}].attachment`,
          message: 'content[].attachment is required',
          severity: 'error',
        });
      } else {
        const att = cObj['attachment'] as Record<string, unknown>;
        // attachment phải có ít nhất data hoặc url
        if (!att['data'] && !att['url']) {
          errors.push({
            path: `content[${i}].attachment`,
            message: 'attachment must have either data (base64) or url',
            severity: 'error',
          });
        }
      }
    });
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
