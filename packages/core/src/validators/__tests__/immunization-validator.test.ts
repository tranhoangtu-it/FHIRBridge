/**
 * Tests for the FHIR R4 Immunization validator.
 * Dùng context Việt Nam / Nhật Bản: trung tâm tiêm chủng VN, vaccine COVID-19 CVX 207.
 */

import { describe, it, expect } from 'vitest';
import { validateImmunization } from '../immunization-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * COVID-19 mRNA vaccine (Moderna) — CVX 207
 * Bệnh nhân tại Trung tâm Y tế Quận 1, TP.HCM
 */
const validImmunization = {
  resourceType: 'Immunization',
  id: 'imm-covid19-moderna-001',
  identifier: [
    {
      system: 'https://tiemchung.gov.vn/identifier',
      value: 'VN-2021-COVID-00123',
    },
  ],
  status: 'completed',
  vaccineCode: {
    coding: [
      {
        system: 'http://hl7.org/fhir/sid/cvx',
        code: '207',
        display: 'COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5 mL dose',
      },
    ],
    text: 'Vaccine COVID-19 Moderna (Spikevax)',
  },
  patient: {
    reference: 'Patient/bn-nguyen-van-a',
    display: 'Nguyễn Văn A',
  },
  occurrenceDateTime: '2021-09-15T08:30:00+07:00',
  recorded: '2021-09-15T09:00:00+07:00',
  primarySource: true,
  manufacturer: {
    display: 'ModernaTX, Inc.',
  },
  lotNumber: 'MOD-LOT-2021-3A7B',
  expirationDate: '2022-03-15',
  site: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '368209003',
        display: 'Right arm',
      },
    ],
    text: 'Cánh tay phải',
  },
  route: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '78421000',
        display: 'Intramuscular route',
      },
    ],
  },
  doseQuantity: {
    value: 0.5,
    unit: 'mL',
    system: 'http://unitsofmeasure.org',
    code: 'mL',
  },
  performer: [
    {
      function: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0443',
            code: 'AP',
            display: 'Administering Provider',
          },
        ],
      },
      actor: {
        reference: 'Practitioner/bs-tran-thi-b',
        display: 'BS. Trần Thị B',
      },
    },
  ],
  protocolApplied: [
    {
      series: 'COVID-19 2-dose primary series',
      doseNumberPositiveInt: 2,
      seriesDosesPositiveInt: 2,
    },
  ],
};

/** Vaccine cúm SNOMED CT — bệnh nhân Nhật Bản tại bệnh viện Tokyo */
const validImmunizationSnomed = {
  resourceType: 'Immunization',
  id: 'imm-flu-jp-2023',
  status: 'completed',
  vaccineCode: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '46233009',
        display: 'Influenza virus vaccine',
      },
    ],
    text: 'インフルエンザHAワクチン',
  },
  patient: {
    reference: 'Patient/pt-tanaka-ichiro',
  },
  occurrenceDateTime: '2023-11-01T10:00:00+09:00',
};

/** Vaccine chưa tiêm (not-done) với occurrenceString */
const notDoneImmunization = {
  resourceType: 'Immunization',
  id: 'imm-hepb-not-done',
  status: 'not-done',
  statusReason: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '310376006',
        display: 'Immunization consent not given',
      },
    ],
  },
  vaccineCode: {
    text: 'Viêm gan B (Hepatitis B)',
  },
  patient: {
    reference: 'Patient/bn-le-thi-c',
  },
  occurrenceString: 'Chưa tiêm — bệnh nhân từ chối',
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateImmunization', () => {
  it('returns valid for a complete COVID-19 Immunization resource', () => {
    const result = validateImmunization(validImmunization);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid for minimal Immunization with SNOMED vaccine code', () => {
    const result = validateImmunization(validImmunizationSnomed);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid for not-done status with occurrenceString', () => {
    const result = validateImmunization(notDoneImmunization);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  // ── resourceType ──────────────────────────────────────────────────────────

  it('returns error if resourceType is not "Immunization"', () => {
    const result = validateImmunization({
      ...validImmunization,
      resourceType: 'ImmunizationRecommendation',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('returns error for null resource', () => {
    const result = validateImmunization(null);
    expect(result.valid).toBe(false);
  });

  it('returns error for non-object resource', () => {
    const result = validateImmunization('Immunization/123');
    expect(result.valid).toBe(false);
  });

  // ── status ────────────────────────────────────────────────────────────────

  it('returns error when status is missing', () => {
    const { status, ...rest } = validImmunization;
    const result = validateImmunization(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('returns error for invalid status value', () => {
    const result = validateImmunization({ ...validImmunization, status: 'cancelled' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['completed', 'entered-in-error', 'not-done']) {
      const resource = {
        ...validImmunization,
        status,
        // not-done cần occurrenceString hoặc occurrenceDateTime
      };
      const result = validateImmunization(resource);
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── vaccineCode ───────────────────────────────────────────────────────────

  it('returns error when vaccineCode is missing', () => {
    const { vaccineCode, ...rest } = validImmunization;
    const result = validateImmunization(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'vaccineCode' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('returns error when vaccineCode has neither coding nor text', () => {
    const result = validateImmunization({ ...validImmunization, vaccineCode: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'vaccineCode' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('accepts vaccineCode with text only', () => {
    const result = validateImmunization({
      ...validImmunization,
      vaccineCode: { text: 'Rotavirus vaccine' },
    });
    expect(
      result.errors.filter((e) => e.path === 'vaccineCode' && e.severity === 'error'),
    ).toHaveLength(0);
  });

  it('warns when vaccineCode.coding uses unknown system', () => {
    const result = validateImmunization({
      ...validImmunization,
      vaccineCode: {
        coding: [{ system: 'http://local-hospital.vn/vaccine-codes', code: 'COV001' }],
      },
    });
    expect(result.errors.some((e) => e.severity === 'warning' && e.path.includes('system'))).toBe(
      true,
    );
  });

  // ── patient ───────────────────────────────────────────────────────────────

  it('returns error when patient is missing', () => {
    const { patient, ...rest } = validImmunization;
    const result = validateImmunization(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'patient' && e.severity === 'error')).toBe(true);
  });

  it('returns error when patient reference is not a valid Reference object', () => {
    const result = validateImmunization({ ...validImmunization, patient: 'Patient/123' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'patient' && e.severity === 'error')).toBe(true);
  });

  it('returns error when patient Reference has no reference/identifier/display', () => {
    const result = validateImmunization({ ...validImmunization, patient: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'patient' && e.severity === 'error')).toBe(true);
  });

  // ── occurrence[x] choice enforcement ─────────────────────────────────────

  it('returns error when both occurrenceDateTime and occurrenceString are present', () => {
    const result = validateImmunization({
      ...validImmunization,
      occurrenceDateTime: '2021-09-15T08:30:00+07:00',
      occurrenceString: 'September 2021',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'occurrence[x]' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('returns error when neither occurrenceDateTime nor occurrenceString is present', () => {
    const { occurrenceDateTime, ...rest } = validImmunization;
    const result = validateImmunization(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'occurrence[x]' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('accepts occurrenceDateTime only', () => {
    const result = validateImmunization(validImmunization);
    expect(result.errors.filter((e) => e.path === 'occurrence[x]')).toHaveLength(0);
  });

  it('accepts occurrenceString only (no occurrenceDateTime)', () => {
    const { occurrenceDateTime, ...rest } = validImmunization;
    const result = validateImmunization({ ...rest, occurrenceString: 'Tháng 9/2021' });
    expect(
      result.errors.filter((e) => e.path === 'occurrence[x]' && e.severity === 'error'),
    ).toHaveLength(0);
  });

  // ── performer ─────────────────────────────────────────────────────────────

  it('returns error when performer entry is missing actor', () => {
    const result = validateImmunization({
      ...validImmunization,
      performer: [{ function: { text: 'AP' } }],
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'performer[0].actor' && e.severity === 'error'),
    ).toBe(true);
  });

  it('returns error when performer is not an array', () => {
    const result = validateImmunization({
      ...validImmunization,
      performer: { actor: { reference: 'Practitioner/1' } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'performer' && e.severity === 'error')).toBe(true);
  });

  // ── protocolApplied ───────────────────────────────────────────────────────

  it('returns error when doseNumberPositiveInt is not a positive integer', () => {
    const result = validateImmunization({
      ...validImmunization,
      protocolApplied: [{ series: 'Test', doseNumberPositiveInt: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('doseNumberPositiveInt'))).toBe(true);
  });

  it('accepts valid protocolApplied entry', () => {
    const result = validateImmunization({
      ...validImmunization,
      protocolApplied: [
        { series: 'COVID-19 2-dose series', doseNumberPositiveInt: 1, seriesDosesPositiveInt: 2 },
      ],
    });
    expect(
      result.errors.filter((e) => e.path.includes('protocolApplied') && e.severity === 'error'),
    ).toHaveLength(0);
  });
});
