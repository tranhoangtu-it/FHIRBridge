/**
 * Tests for the FHIR R4 CareTeam validator.
 * Use case: nhóm điều trị đa chuyên khoa (VN hospital context).
 */

import { describe, it, expect } from 'vitest';
import { validateCareTeam } from '../care-team-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Đội điều trị ung thư đa chuyên khoa */
const validCareTeam = {
  resourceType: 'CareTeam',
  id: 'careteam-oncology-001',
  identifier: [{ system: 'http://hospital.vn/careteams', value: 'CT-2024-001' }],
  status: 'active',
  category: [
    {
      coding: [
        {
          system: 'http://loinc.org',
          code: 'LA27976-2',
          display: 'Encounter-focused care team',
        },
      ],
    },
  ],
  name: 'Nhóm điều trị ung thư đa chuyên khoa',
  subject: { reference: 'Patient/patient-001' },
  period: { start: '2024-01-01' },
  participant: [
    {
      role: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '17561000',
              display: 'Cardiologist',
            },
          ],
        },
      ],
      member: { reference: 'Practitioner/practitioner-001', display: 'BS. Nguyễn Văn A' },
      period: { start: '2024-01-01' },
    },
    {
      role: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '224535009',
              display: 'Registered nurse',
            },
          ],
        },
      ],
      member: { reference: 'Practitioner/practitioner-002', display: 'ĐD. Trần Thị B' },
    },
  ],
  managingOrganization: [{ reference: 'Organization/hospital-001' }],
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateCareTeam', () => {
  it('returns valid for a complete CareTeam resource', () => {
    const result = validateCareTeam(validCareTeam);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid with minimal fields (resourceType only)', () => {
    const minimal = { resourceType: 'CareTeam' };
    const result = validateCareTeam(minimal);
    // status, subject, participant là warning — không nên fail
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  // ── resourceType checks ───────────────────────────────────────────────────

  it('returns error if resourceType is not "CareTeam"', () => {
    const result = validateCareTeam({ ...validCareTeam, resourceType: 'CarePlan' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  // ── status validation ─────────────────────────────────────────────────────

  it('returns error for invalid status value', () => {
    const result = validateCareTeam({ ...validCareTeam, status: 'draft' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['proposed', 'active', 'suspended', 'inactive', 'entered-in-error']) {
      const result = validateCareTeam({ ...validCareTeam, status });
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  it('returns valid when status is omitted (optional field)', () => {
    const { status, ...rest } = validCareTeam;
    const result = validateCareTeam(rest);
    expect(result.errors.filter((e) => e.path === 'status' && e.severity === 'error')).toHaveLength(
      0,
    );
  });

  // ── subject validation ────────────────────────────────────────────────────

  it('warns when subject is missing', () => {
    const { subject, ...rest } = validCareTeam;
    const result = validateCareTeam(rest);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'warning')).toBe(true);
  });

  it('returns error when subject is not a Reference object', () => {
    const result = validateCareTeam({ ...validCareTeam, subject: 'Patient/001' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'error')).toBe(true);
  });

  // ── participant validation ────────────────────────────────────────────────

  it('warns when participant is missing', () => {
    const { participant, ...rest } = validCareTeam;
    const result = validateCareTeam(rest);
    expect(result.errors.some((e) => e.path === 'participant' && e.severity === 'warning')).toBe(
      true,
    );
  });

  it('returns error when participant is not an array', () => {
    const result = validateCareTeam({ ...validCareTeam, participant: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'participant' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('warns when participant entry has no member', () => {
    const result = validateCareTeam({
      ...validCareTeam,
      participant: [{ role: [{ text: 'Bác sĩ' }] }],
    });
    expect(
      result.errors.some((e) => e.path === 'participant[0].member' && e.severity === 'warning'),
    ).toBe(true);
  });

  it('returns error when participant.role is not an array', () => {
    const result = validateCareTeam({
      ...validCareTeam,
      participant: [{ member: { reference: 'Practitioner/001' }, role: { text: 'BS' } }],
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'participant[0].role' && e.severity === 'error'),
    ).toBe(true);
  });

  // ── name validation ───────────────────────────────────────────────────────

  it('returns error when name is not a string', () => {
    const result = validateCareTeam({ ...validCareTeam, name: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'name' && e.severity === 'error')).toBe(true);
  });

  it('returns error when resource is null', () => {
    const result = validateCareTeam(null);
    expect(result.valid).toBe(false);
  });
});
