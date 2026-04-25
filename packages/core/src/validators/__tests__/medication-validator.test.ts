/**
 * Tests for the FHIR R4 Medication validator.
 * Dùng tên thuốc Việt Nam và mã RxNorm/SNOMED thực tế.
 */

import { describe, it, expect } from 'vitest';
import { validateMedication } from '../medication-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Paracetamol 500mg — RxNorm 161 */
const validMedication = {
  resourceType: 'Medication',
  id: 'med-paracetamol-500',
  code: {
    coding: [
      {
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: '161',
        display: 'Acetaminophen',
      },
    ],
    text: 'Paracetamol 500mg',
  },
  status: 'active',
  form: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '385055001',
        display: 'Tablet',
      },
    ],
  },
  ingredient: [
    {
      itemCodeableConcept: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '161' }],
      },
      isActive: true,
      strength: {
        numerator: { value: 500, unit: 'mg', system: 'http://unitsofmeasure.org', code: 'mg' },
        denominator: { value: 1, unit: 'tablet' },
      },
    },
  ],
  batch: {
    lotNumber: 'LOT-2024-001',
    expirationDate: '2026-12-31',
  },
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateMedication', () => {
  it('returns valid for a complete Medication resource', () => {
    const result = validateMedication(validMedication);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid with minimal fields (code.text only)', () => {
    const minimal = {
      resourceType: 'Medication',
      code: { text: 'Amoxicillin 500mg' },
    };
    const result = validateMedication(minimal);
    expect(result.valid).toBe(true);
  });

  // ── resourceType checks ───────────────────────────────────────────────────

  it('returns error if resourceType is not "Medication"', () => {
    const result = validateMedication({ ...validMedication, resourceType: 'MedicationRequest' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  // ── code validation ───────────────────────────────────────────────────────

  it('returns error when code is missing', () => {
    const { code, ...rest } = validMedication;
    const result = validateMedication(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'code' && e.severity === 'error')).toBe(true);
  });

  it('returns error when code has neither coding nor text', () => {
    const result = validateMedication({ ...validMedication, code: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'code')).toBe(true);
  });

  it('accepts code with text only (no coding)', () => {
    const result = validateMedication({ ...validMedication, code: { text: 'Metformin 850mg' } });
    expect(result.errors.filter((e) => e.path === 'code' && e.severity === 'error')).toHaveLength(
      0,
    );
  });

  it('warns when coding system is not RxNorm or SNOMED', () => {
    const result = validateMedication({
      ...validMedication,
      code: { coding: [{ system: 'http://example.local/drugs', code: 'D001' }] },
    });
    expect(result.errors.some((e) => e.severity === 'warning' && e.path.includes('system'))).toBe(
      true,
    );
  });

  // ── status validation ─────────────────────────────────────────────────────

  it('returns error for invalid status value', () => {
    const result = validateMedication({ ...validMedication, status: 'discontinued' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['active', 'inactive', 'entered-in-error']) {
      const result = validateMedication({ ...validMedication, status });
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── ingredient validation ─────────────────────────────────────────────────

  it('returns error when ingredient is not an array', () => {
    const result = validateMedication({ ...validMedication, ingredient: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'ingredient')).toBe(true);
  });

  it('returns error when ingredient entry has no item[x]', () => {
    const result = validateMedication({
      ...validMedication,
      ingredient: [{ isActive: true }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'ingredient[0]')).toBe(true);
  });

  it('returns error when resource is null', () => {
    const result = validateMedication(null);
    expect(result.valid).toBe(false);
  });
});
