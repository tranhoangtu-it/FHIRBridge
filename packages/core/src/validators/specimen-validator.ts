/**
 * FHIR R4 Specimen resource validator.
 * Validates Specimen-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/specimen.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho Specimen.status (FHIR R4 §Specimen.status ValueSet) */
const VALID_STATUSES = new Set(['available', 'unavailable', 'unsatisfactory', 'entered-in-error']);

/**
 * Hệ thống mã loại mẫu bệnh phẩm được hỗ trợ.
 * SNOMED CT là tiêu chuẩn quốc tế cho specimen type.
 */
const SUPPORTED_SPECIMEN_TYPE_SYSTEMS = new Set([
  'http://snomed.info/sct', // SNOMED CT (quốc tế)
  'http://terminology.hl7.org/CodeSystem/v2-0487', // HL7 v2 specimen type
]);

/**
 * Kiểm tra reference object có hợp lệ không.
 * Phải có ít nhất một trong: reference, identifier, display.
 */
function hasValidReference(ref: unknown): boolean {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Record<string, unknown>;
  if (r['reference'] === undefined && r['identifier'] === undefined && r['display'] === undefined) {
    return false;
  }
  if (r['reference'] !== undefined && typeof r['reference'] !== 'string') {
    return false;
  }
  return true;
}

/**
 * Kiểm tra Quantity object có hợp lệ không (nếu được cung cấp).
 * value phải là số nếu có; unit phải là chuỗi nếu có.
 */
function validateQuantityField(qty: unknown, path: string, errors: ValidationError[]): void {
  if (!qty || typeof qty !== 'object' || Array.isArray(qty)) {
    errors.push({
      path,
      message: `${path} must be a Quantity object`,
      severity: 'error',
    });
    return;
  }
  const q = qty as Record<string, unknown>;
  if (q['value'] !== undefined && typeof q['value'] !== 'number') {
    errors.push({
      path: `${path}.value`,
      message: `${path}.value must be a number`,
      severity: 'error',
    });
  }
  if (q['unit'] !== undefined && typeof q['unit'] !== 'string') {
    errors.push({
      path: `${path}.unit`,
      message: `${path}.unit must be a string`,
      severity: 'error',
    });
  }
}

/**
 * Validate a FHIR R4 Specimen resource.
 *
 * Không có required field bắt buộc ở mức resource (tất cả optional theo FHIR R4),
 * nhưng các trường must-support được kiểm tra về kiểu dữ liệu khi có mặt.
 * Spec: https://hl7.org/fhir/R4/specimen.html
 */
export function validateSpecimen(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // ── resourceType ──────────────────────────────────────────────────────────
  if (r['resourceType'] !== 'Specimen') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "Specimen"',
      severity: 'error',
    });
  }

  // ── status (optional, nhưng nếu có phải hợp lệ) ──────────────────────────
  if (r['status'] !== undefined) {
    if (!VALID_STATUSES.has(r['status'] as string)) {
      errors.push({
        path: 'status',
        message:
          'Specimen.status must be one of: available, unavailable, unsatisfactory, entered-in-error',
        severity: 'error',
      });
    }
  }

  // ── type (optional) — kiểm tra CodeableConcept structure và system ────────
  if (r['type'] !== undefined && r['type'] !== null) {
    if (typeof r['type'] !== 'object' || Array.isArray(r['type'])) {
      errors.push({
        path: 'type',
        message: 'Specimen.type must be a CodeableConcept object',
        severity: 'error',
      });
    } else {
      const typeCC = r['type'] as Record<string, unknown>;
      const hasCoding = Array.isArray(typeCC['coding']) && typeCC['coding'].length > 0;
      const hasText = typeof typeCC['text'] === 'string' && typeCC['text'].trim() !== '';

      if (!hasCoding && !hasText) {
        errors.push({
          path: 'type',
          message: 'Specimen.type must have at least one coding or a text value',
          severity: 'warning',
        });
      }

      // Khuyến nghị dùng SNOMED CT hoặc HL7 v2-0487
      if (hasCoding) {
        const codings = typeCC['coding'] as Record<string, unknown>[];
        const hasKnownSystem = codings.some(
          (c) =>
            c &&
            typeof c['system'] === 'string' &&
            SUPPORTED_SPECIMEN_TYPE_SYSTEMS.has(c['system']),
        );
        if (!hasKnownSystem) {
          errors.push({
            path: 'type.coding[].system',
            message:
              'Specimen.type.coding should use SNOMED CT (http://snomed.info/sct) or HL7 v2-0487 system',
            severity: 'warning',
          });
        }
      }
    }
  }

  // ── subject (optional) — nếu có phải là valid Reference ──────────────────
  if (r['subject'] !== undefined && r['subject'] !== null) {
    if (!hasValidReference(r['subject'])) {
      errors.push({
        path: 'subject',
        message: 'Specimen.subject must be a valid Reference object',
        severity: 'error',
      });
    }
  }

  // ── parent (optional array) ───────────────────────────────────────────────
  if (r['parent'] !== undefined) {
    if (!Array.isArray(r['parent'])) {
      errors.push({
        path: 'parent',
        message: 'Specimen.parent must be an array of References',
        severity: 'error',
      });
    } else {
      const parents = r['parent'] as unknown[];
      parents.forEach((p, i) => {
        if (!hasValidReference(p)) {
          errors.push({
            path: `parent[${i}]`,
            message: 'Each Specimen.parent entry must be a valid Reference',
            severity: 'error',
          });
        }
      });
    }
  }

  // ── request (optional array) ──────────────────────────────────────────────
  if (r['request'] !== undefined) {
    if (!Array.isArray(r['request'])) {
      errors.push({
        path: 'request',
        message: 'Specimen.request must be an array of References',
        severity: 'error',
      });
    } else {
      const requests = r['request'] as unknown[];
      requests.forEach((req, i) => {
        if (!hasValidReference(req)) {
          errors.push({
            path: `request[${i}]`,
            message: 'Each Specimen.request entry must be a valid Reference (ServiceRequest)',
            severity: 'error',
          });
        }
      });
    }
  }

  // ── collection (optional) — kiểm tra các trường con ──────────────────────
  if (r['collection'] !== undefined && r['collection'] !== null) {
    if (typeof r['collection'] !== 'object' || Array.isArray(r['collection'])) {
      errors.push({
        path: 'collection',
        message: 'Specimen.collection must be an object',
        severity: 'error',
      });
    } else {
      const coll = r['collection'] as Record<string, unknown>;

      // collector phải là valid Reference nếu có
      if (coll['collector'] !== undefined && !hasValidReference(coll['collector'])) {
        errors.push({
          path: 'collection.collector',
          message: 'Specimen.collection.collector must be a valid Reference',
          severity: 'error',
        });
      }

      // quantity phải là Quantity object nếu có
      if (coll['quantity'] !== undefined) {
        validateQuantityField(coll['quantity'], 'collection.quantity', errors);
      }
    }
  }

  // ── processing (optional array) ───────────────────────────────────────────
  if (r['processing'] !== undefined) {
    if (!Array.isArray(r['processing'])) {
      errors.push({
        path: 'processing',
        message: 'Specimen.processing must be an array',
        severity: 'error',
      });
    } else {
      const steps = r['processing'] as unknown[];
      steps.forEach((step, i) => {
        if (!step || typeof step !== 'object') {
          errors.push({
            path: `processing[${i}]`,
            message: 'Each processing step must be an object',
            severity: 'error',
          });
          return;
        }
        const s = step as Record<string, unknown>;
        // additive phải là array of References nếu có
        if (s['additive'] !== undefined) {
          if (!Array.isArray(s['additive'])) {
            errors.push({
              path: `processing[${i}].additive`,
              message: 'Specimen.processing[].additive must be an array of References',
              severity: 'error',
            });
          } else {
            const additives = s['additive'] as unknown[];
            additives.forEach((a, j) => {
              if (!hasValidReference(a)) {
                errors.push({
                  path: `processing[${i}].additive[${j}]`,
                  message: 'Each processing additive must be a valid Reference',
                  severity: 'error',
                });
              }
            });
          }
        }
      });
    }
  }

  // ── container (optional array) ────────────────────────────────────────────
  if (r['container'] !== undefined) {
    if (!Array.isArray(r['container'])) {
      errors.push({
        path: 'container',
        message: 'Specimen.container must be an array',
        severity: 'error',
      });
    } else {
      const containers = r['container'] as unknown[];
      containers.forEach((c, i) => {
        if (!c || typeof c !== 'object') {
          errors.push({
            path: `container[${i}]`,
            message: 'Each container entry must be an object',
            severity: 'error',
          });
          return;
        }
        const cont = c as Record<string, unknown>;
        // capacity phải là Quantity nếu có
        if (cont['capacity'] !== undefined) {
          validateQuantityField(cont['capacity'], `container[${i}].capacity`, errors);
        }
        // specimenQuantity phải là Quantity nếu có
        if (cont['specimenQuantity'] !== undefined) {
          validateQuantityField(
            cont['specimenQuantity'],
            `container[${i}].specimenQuantity`,
            errors,
          );
        }
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
