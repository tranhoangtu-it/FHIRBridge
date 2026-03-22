/**
 * Tests for resource-transformer: raw-to-FHIR field mapping and date normalization.
 */

import { describe, it, expect } from 'vitest';
import { transformToFhir } from '../resource-transformer.js';

describe('transformToFhir', () => {
  describe('direct field mapping (no mappingConfig)', () => {
    it('copies raw fields directly when no mapping config provided', () => {
      const raw = { id: 'p-001', gender: 'male', active: 'true' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;

      expect(result['resourceType']).toBe('Patient');
      expect(result['id']).toBe('p-001');
      expect(result['gender']).toBe('male');
    });

    it('coerces boolean string "true" to true', () => {
      const raw = { active: 'true' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['active']).toBe(true);
    });

    it('coerces boolean string "false" to false', () => {
      const raw = { active: 'false' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['active']).toBe(false);
    });

    it('handles missing/undefined field values gracefully', () => {
      const raw: Record<string, unknown> = { id: 'p-001', name: undefined };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['id']).toBe('p-001');
      expect(result['name']).toBeUndefined();
    });
  });

  describe('custom mapping config', () => {
    it('remaps source fields to FHIR paths', () => {
      const raw = { pt_id: 'p-001', pt_gender: 'female' };
      const mapping = { pt_id: 'id', pt_gender: 'gender' };
      const result = transformToFhir(raw, 'Patient', mapping) as Record<string, unknown>;

      expect(result['resourceType']).toBe('Patient');
      expect(result['id']).toBe('p-001');
      expect(result['gender']).toBe('female');
    });

    it('skips source fields not present in raw data', () => {
      const raw = { pt_id: 'p-001' };
      const mapping = { pt_id: 'id', missing_field: 'gender' };
      const result = transformToFhir(raw, 'Patient', mapping) as Record<string, unknown>;

      expect(result['id']).toBe('p-001');
      expect(result['gender']).toBeUndefined();
    });
  });

  describe('date normalization', () => {
    it('normalizes MM/DD/YYYY to ISO 8601', () => {
      const raw = { birthDate: '03/15/1990' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['birthDate']).toBe('1990-03-15');
    });

    it('normalizes YYYYMMDD to ISO 8601', () => {
      const raw = { birthDate: '19900315' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['birthDate']).toBe('1990-03-15');
    });

    it('leaves already ISO 8601 date unchanged', () => {
      const raw = { birthDate: '1990-03-15' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['birthDate']).toBe('1990-03-15');
    });

    it('returns unrecognized date format as-is', () => {
      const raw = { birthDate: 'March 15 1990' };
      const result = transformToFhir(raw, 'Patient') as Record<string, unknown>;
      expect(result['birthDate']).toBe('March 15 1990');
    });

    it('also normalizes recordedDate field', () => {
      const raw = { recordedDate: '01/01/2020' };
      const result = transformToFhir(raw, 'Condition') as Record<string, unknown>;
      expect(result['recordedDate']).toBe('2020-01-01');
    });
  });

  describe('nested path setting', () => {
    it('sets value at nested dot-notation path', () => {
      const raw = { family_name: 'Smith' };
      const mapping = { family_name: 'name[0].family' };
      const result = transformToFhir(raw, 'Patient', mapping) as Record<
        string,
        { family: string }[]
      >;

      expect(result['name']).toBeDefined();
      expect(result['name']![0]!.family).toBe('Smith');
    });

    it('sets value at deep nested coding path', () => {
      const raw = { loinc_code: '29463-7' };
      const mapping = { loinc_code: 'code.coding[0].code' };
      const result = transformToFhir(raw, 'Observation', mapping) as Record<
        string,
        { coding: { code: string }[] }
      >;

      expect(result['code']?.coding[0]?.code).toBe('29463-7');
    });
  });
});
