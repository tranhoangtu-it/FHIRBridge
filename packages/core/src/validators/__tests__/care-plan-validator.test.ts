/**
 * Tests for the FHIR R4 CarePlan validator.
 * Use case: kế hoạch điều trị tiểu đường type 2, bệnh tim mạch (VN context).
 */

import { describe, it, expect } from 'vitest';
import { validateCarePlan } from '../care-plan-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Kế hoạch điều trị tiểu đường type 2 */
const validCarePlan = {
  resourceType: 'CarePlan',
  id: 'careplan-diabetes-type2-001',
  identifier: [{ system: 'http://hospital.vn/careplans', value: 'CP-2024-001' }],
  status: 'active',
  intent: 'plan',
  category: [
    {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '44054006',
          display: 'Diabetes mellitus type 2',
        },
      ],
    },
  ],
  title: 'Kế hoạch điều trị đái tháo đường type 2',
  description: 'Kiểm soát đường huyết, chế độ ăn và luyện tập',
  subject: { reference: 'Patient/patient-001' },
  encounter: { reference: 'Encounter/enc-001' },
  period: { start: '2024-01-01', end: '2024-12-31' },
  created: '2024-01-01T08:00:00+07:00',
  author: { reference: 'Practitioner/practitioner-001' },
  careTeam: [{ reference: 'CareTeam/careteam-001' }],
  addresses: [{ reference: 'Condition/condition-diabetes' }],
  activity: [
    {
      detail: {
        kind: 'ServiceRequest',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '73761001',
              display: 'Colonoscopy',
            },
          ],
        },
        status: 'in-progress',
        description: 'Xét nghiệm HbA1c mỗi 3 tháng',
      },
    },
  ],
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateCarePlan', () => {
  it('returns valid for a complete CarePlan resource', () => {
    const result = validateCarePlan(validCarePlan);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid with minimal required fields', () => {
    const minimal = {
      resourceType: 'CarePlan',
      status: 'active',
      intent: 'plan',
      subject: { reference: 'Patient/p-001' },
    };
    const result = validateCarePlan(minimal);
    expect(result.valid).toBe(true);
  });

  // ── resourceType checks ───────────────────────────────────────────────────

  it('returns error if resourceType is not "CarePlan"', () => {
    const result = validateCarePlan({ ...validCarePlan, resourceType: 'CareTeam' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  // ── status validation ─────────────────────────────────────────────────────

  it('returns error when status is missing', () => {
    const { status, ...rest } = validCarePlan;
    const result = validateCarePlan(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('returns error for invalid status value', () => {
    const result = validateCarePlan({ ...validCarePlan, status: 'suspended' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of [
      'draft',
      'active',
      'on-hold',
      'revoked',
      'completed',
      'entered-in-error',
      'unknown',
    ]) {
      const result = validateCarePlan({ ...validCarePlan, status });
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── intent validation ─────────────────────────────────────────────────────

  it('returns error when intent is missing', () => {
    const { intent, ...rest } = validCarePlan;
    const result = validateCarePlan(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'intent' && e.severity === 'error')).toBe(true);
  });

  it('returns error for invalid intent value', () => {
    const result = validateCarePlan({ ...validCarePlan, intent: 'request' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'intent' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid intent values', () => {
    for (const intent of ['proposal', 'plan', 'order', 'option', 'directive']) {
      const result = validateCarePlan({ ...validCarePlan, intent });
      expect(
        result.errors.filter((e) => e.path === 'intent' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── subject validation ────────────────────────────────────────────────────

  it('returns error when subject is missing', () => {
    const { subject, ...rest } = validCarePlan;
    const result = validateCarePlan(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'error')).toBe(true);
  });

  it('returns error when subject has no reference or identifier', () => {
    const result = validateCarePlan({ ...validCarePlan, subject: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'error')).toBe(true);
  });

  // ── activity validation ───────────────────────────────────────────────────

  it('returns error when activity.detail.status is missing', () => {
    const result = validateCarePlan({
      ...validCarePlan,
      activity: [{ detail: { code: { text: 'Test' } } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'activity[0].detail.status')).toBe(true);
  });

  it('returns error for invalid activity.detail.status', () => {
    const result = validateCarePlan({
      ...validCarePlan,
      activity: [{ detail: { status: 'pending' } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'activity[0].detail.status')).toBe(true);
  });

  it('accepts activity without detail (reference-only activity)', () => {
    const result = validateCarePlan({
      ...validCarePlan,
      activity: [{ reference: { reference: 'ServiceRequest/sr-001' } }],
    });
    expect(
      result.errors.filter((e) => e.path.startsWith('activity[0]') && e.severity === 'error'),
    ).toHaveLength(0);
  });

  it('returns error when resource is null', () => {
    const result = validateCarePlan(null);
    expect(result.valid).toBe(false);
  });
});
