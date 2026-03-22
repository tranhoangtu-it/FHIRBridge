/**
 * Tests for coding-validator: Coding and CodeableConcept validation.
 */

import { describe, it, expect } from 'vitest';
import { validateCoding, validateCodeableConcept } from '../coding-validator.js';
import { LOINC_SYSTEM } from '../../coding/code-systems.js';

describe('validateCoding', () => {
  it('passes for valid coding with known LOINC system and non-empty code', () => {
    const result = validateCoding({
      system: LOINC_SYSTEM,
      code: '29463-7',
      display: 'Body weight',
    });

    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('produces a warning for coding with unknown system URI', () => {
    const result = validateCoding({
      system: 'http://unknown-terminology.org',
      code: 'ABC-001',
    });

    const warnings = result.errors.filter((e) => e.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('not a recognized FHIR terminology URI'))).toBe(
      true,
    );
    // No code errors — only warning
    expect(result.valid).toBe(true);
  });

  it('produces error for empty code string', () => {
    const result = validateCoding({
      system: LOINC_SYSTEM,
      code: '',
    });

    expect(result.valid).toBe(false);
    const errors = result.errors.filter((e) => e.severity === 'error');
    expect(errors.some((e) => e.path.endsWith('.code'))).toBe(true);
  });

  it('produces error when code is missing entirely', () => {
    const result = validateCoding({ system: LOINC_SYSTEM });

    expect(result.valid).toBe(false);
    const errors = result.errors.filter((e) => e.severity === 'error');
    expect(errors.some((e) => e.path.endsWith('.code'))).toBe(true);
  });

  it('produces error for non-object input', () => {
    const result = validateCoding('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain('non-null object');
  });

  it('produces error for null input', () => {
    const result = validateCoding(null);
    expect(result.valid).toBe(false);
  });

  it('produces warning when system is missing', () => {
    const result = validateCoding({ code: '29463-7' });
    const warnings = result.errors.filter((e) => e.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('strongly recommended'))).toBe(true);
  });

  it('produces error when expectedSystem does not match', () => {
    const result = validateCoding(
      { system: LOINC_SYSTEM, code: '29463-7' },
      'coding',
      'http://snomed.info/sct',
    );

    expect(result.valid).toBe(false);
    const errors = result.errors.filter((e) => e.severity === 'error');
    expect(errors.some((e) => e.message.includes('http://snomed.info/sct'))).toBe(true);
  });
});

describe('validateCodeableConcept', () => {
  it('passes for valid CodeableConcept with known LOINC coding', () => {
    const result = validateCodeableConcept({
      coding: [{ system: LOINC_SYSTEM, code: '29463-7', display: 'Body weight' }],
    });

    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('passes when only text is provided (no coding)', () => {
    const result = validateCodeableConcept({ text: 'Body weight measurement' });
    expect(result.valid).toBe(true);
  });

  it('passes for empty coding array because array is truthy (spec allows it)', () => {
    // coding: [] satisfies "has coding key" — no text error fires.
    // Empty entries are iterated, but there are none, so no sub-errors.
    const result = validateCodeableConcept({ coding: [] });
    expect(result.valid).toBe(true);
  });

  it('fails when both coding and text keys are absent', () => {
    const result = validateCodeableConcept({});
    expect(result.valid).toBe(false);
    const errors = result.errors.filter((e) => e.severity === 'error');
    expect(errors.some((e) => e.message.includes('coding or text'))).toBe(true);
  });

  it('fails when coding array contains invalid coding', () => {
    const result = validateCodeableConcept({
      coding: [{ system: LOINC_SYSTEM, code: '' }],
    });

    expect(result.valid).toBe(false);
    const errors = result.errors.filter((e) => e.severity === 'error');
    expect(errors.some((e) => e.path.includes('.code'))).toBe(true);
  });

  it('fails for non-object input', () => {
    const result = validateCodeableConcept('not-an-object');
    expect(result.valid).toBe(false);
  });
});
