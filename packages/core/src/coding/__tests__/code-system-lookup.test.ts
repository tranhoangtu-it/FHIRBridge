/**
 * Tests for code-system-lookup: lookupCode, isKnownCode, getCodesForSystem.
 */

import { describe, it, expect } from 'vitest';
import { lookupCode, isKnownCode, getCodesForSystem } from '../code-system-lookup.js';
import { LOINC_SYSTEM, SNOMED_SYSTEM, RXNORM_SYSTEM } from '../code-systems.js';

describe('lookupCode', () => {
  it('returns CodeInfo for a known LOINC code', () => {
    const result = lookupCode(LOINC_SYSTEM, '29463-7');
    expect(result).toBeDefined();
    expect(result!.display).toBe('Body weight');
    expect(result!.system).toBe(LOINC_SYSTEM);
    expect(result!.code).toBe('29463-7');
  });

  it('returns CodeInfo for a known SNOMED code', () => {
    const result = lookupCode(SNOMED_SYSTEM, '44054006');
    expect(result).toBeDefined();
    expect(result!.display).toBe('Diabetes mellitus type 2');
  });

  it('returns CodeInfo for a known RxNorm code', () => {
    const result = lookupCode(RXNORM_SYSTEM, '198440');
    expect(result).toBeDefined();
    expect(result!.display).toContain('Metformin');
  });

  it('returns undefined for an unknown code in known system', () => {
    const result = lookupCode(LOINC_SYSTEM, '99999-9');
    expect(result).toBeUndefined();
  });

  it('returns undefined for an entirely unknown system', () => {
    const result = lookupCode('http://example.com/unknown-system', '29463-7');
    expect(result).toBeUndefined();
  });
});

describe('isKnownCode', () => {
  it('returns true for a known LOINC code', () => {
    expect(isKnownCode(LOINC_SYSTEM, '8310-5')).toBe(true);
  });

  it('returns true for a known SNOMED code', () => {
    expect(isKnownCode(SNOMED_SYSTEM, '38341003')).toBe(true);
  });

  it('returns true for a known RxNorm code', () => {
    expect(isKnownCode(RXNORM_SYSTEM, '311702')).toBe(true);
  });

  it('returns false for an unknown code', () => {
    expect(isKnownCode(LOINC_SYSTEM, 'NOT-A-CODE')).toBe(false);
  });

  it('returns false for unknown system', () => {
    expect(isKnownCode('http://unknown.org', '29463-7')).toBe(false);
  });
});

describe('getCodesForSystem', () => {
  it('returns non-empty array for LOINC system', () => {
    const codes = getCodesForSystem(LOINC_SYSTEM);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes[0]).toMatchObject({ system: LOINC_SYSTEM });
  });

  it('returns non-empty array for SNOMED system', () => {
    const codes = getCodesForSystem(SNOMED_SYSTEM);
    expect(codes.length).toBeGreaterThan(0);
  });

  it('returns non-empty array for RxNorm system', () => {
    const codes = getCodesForSystem(RXNORM_SYSTEM);
    expect(codes.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown system', () => {
    const codes = getCodesForSystem('http://unknown.org');
    expect(codes).toEqual([]);
  });

  it('each code entry has system, code, and display', () => {
    const codes = getCodesForSystem(LOINC_SYSTEM);
    for (const entry of codes) {
      expect(entry.system).toBe(LOINC_SYSTEM);
      expect(typeof entry.code).toBe('string');
      expect(typeof entry.display).toBe('string');
    }
  });
});
