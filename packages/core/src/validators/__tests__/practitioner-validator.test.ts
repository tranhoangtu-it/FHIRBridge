/**
 * Tests for the FHIR R4 Practitioner validator.
 * Dùng tên bác sĩ Việt Nam — không chứa PHI thực.
 */

import { describe, it, expect } from 'vitest';
import { validatePractitioner } from '../practitioner-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPractitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-nguyen-van-a',
  identifier: [
    {
      system: 'http://byt.gov.vn/practitioners',
      value: 'BS-12345',
    },
  ],
  active: true,
  name: [
    {
      use: 'official',
      family: 'Nguyễn',
      given: ['Văn', 'A'],
      prefix: ['BS.'],
    },
  ],
  telecom: [
    { system: 'phone', value: '0912345678', use: 'work' },
    { system: 'email', value: 'nguyenvana@hospital.vn', use: 'work' },
  ],
  address: [
    {
      use: 'work',
      line: ['01 Tôn Thất Tùng'],
      city: 'Hà Nội',
      country: 'VN',
    },
  ],
  gender: 'male',
  birthDate: '1975-03-15',
  qualification: [
    {
      identifier: [{ system: 'http://byt.gov.vn/licenses', value: 'CC-9876' }],
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
        text: 'Bác sĩ Y khoa',
      },
      period: { start: '2000-06-01' },
      issuer: { reference: 'Organization/byt-vn', display: 'Bộ Y tế Việt Nam' },
    },
  ],
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validatePractitioner', () => {
  it('returns valid for a complete Practitioner resource', () => {
    const result = validatePractitioner(validPractitioner);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid with minimal required fields', () => {
    const minimal = {
      resourceType: 'Practitioner',
      name: [{ family: 'Trần' }],
    };
    const result = validatePractitioner(minimal);
    expect(result.valid).toBe(true);
  });

  // ── resourceType checks ───────────────────────────────────────────────────

  it('returns error if resourceType is not "Practitioner"', () => {
    const result = validatePractitioner({ ...validPractitioner, resourceType: 'Patient' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  // ── name validation ───────────────────────────────────────────────────────

  it('warns when name is missing', () => {
    const { name, ...rest } = validPractitioner;
    const result = validatePractitioner(rest);
    expect(result.errors.some((e) => e.path === 'name' && e.severity === 'warning')).toBe(true);
  });

  it('warns when no name entry has a family element', () => {
    const result = validatePractitioner({ ...validPractitioner, name: [{ given: ['Bác sĩ'] }] });
    expect(result.errors.some((e) => e.path === 'name[0].family' && e.severity === 'warning')).toBe(
      true,
    );
  });

  it('returns error when name is not an array', () => {
    const result = validatePractitioner({ ...validPractitioner, name: 'Nguyễn Văn A' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'name' && e.severity === 'error')).toBe(true);
  });

  // ── gender validation ─────────────────────────────────────────────────────

  it('returns error for invalid gender value', () => {
    const result = validatePractitioner({ ...validPractitioner, gender: 'not-valid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'gender' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid gender values', () => {
    for (const gender of ['male', 'female', 'other', 'unknown']) {
      const result = validatePractitioner({ ...validPractitioner, gender });
      expect(
        result.errors.filter((e) => e.path === 'gender' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── birthDate validation ──────────────────────────────────────────────────

  it('returns error for invalid birthDate format', () => {
    const result = validatePractitioner({ ...validPractitioner, birthDate: '15/03/1975' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'birthDate')).toBe(true);
  });

  it('accepts valid YYYY-MM-DD birthDate', () => {
    const result = validatePractitioner({ ...validPractitioner, birthDate: '1980-01-01' });
    expect(
      result.errors.filter((e) => e.path === 'birthDate' && e.severity === 'error'),
    ).toHaveLength(0);
  });

  // ── qualification validation ──────────────────────────────────────────────

  it('returns error when qualification entry missing code', () => {
    const result = validatePractitioner({
      ...validPractitioner,
      qualification: [{ period: { start: '2000-01-01' } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'qualification[0].code')).toBe(true);
  });

  it('accepts practitioner without qualification (optional)', () => {
    const { qualification, ...rest } = validPractitioner;
    const result = validatePractitioner(rest);
    expect(
      result.errors.filter((e) => e.path.startsWith('qualification') && e.severity === 'error'),
    ).toHaveLength(0);
  });

  it('returns error when resource is null', () => {
    const result = validatePractitioner(null);
    expect(result.valid).toBe(false);
  });
});
