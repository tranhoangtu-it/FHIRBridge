/**
 * Code system lookup tables with embedded subsets for common clinical codes.
 * Covers top LOINC vital signs/labs and common SNOMED conditions.
 */

import { LOINC_SYSTEM, SNOMED_SYSTEM, RXNORM_SYSTEM } from './code-systems.js';

/** Result of a code lookup */
export interface CodeInfo {
  system: string;
  code: string;
  display: string;
  category?: string;
}

// ── LOINC embedded subset ────────────────────────────────────────────────────

const LOINC_TABLE: Record<string, string> = {
  // Vital signs
  '8310-5': 'Body temperature',
  '8867-4': 'Heart rate',
  '9279-1': 'Respiratory rate',
  '55284-4': 'Blood pressure systolic and diastolic',
  '8480-6': 'Systolic blood pressure',
  '8462-4': 'Diastolic blood pressure',
  '29463-7': 'Body weight',
  '8302-2': 'Body height',
  '39156-5': 'Body mass index (BMI) [Ratio]',
  '59408-5': 'Oxygen saturation in Arterial blood by Pulse oximetry',
  '2708-6': 'Oxygen saturation in Arterial blood',
  // Labs — CBC
  '26515-7': 'Platelets [#/volume] in Blood',
  '789-8': 'Erythrocytes [#/volume] in Blood by Automated count',
  '718-7': 'Hemoglobin [Mass/volume] in Blood',
  '4544-3': 'Hematocrit [Volume Fraction] of Blood by Automated count',
  '6690-2': 'Leukocytes [#/volume] in Blood by Automated count',
  // Labs — metabolic panel
  '2345-7': 'Glucose [Mass/volume] in Serum or Plasma',
  '3094-0': 'Urea nitrogen [Mass/volume] in Serum or Plasma',
  '2160-0': 'Creatinine [Mass/volume] in Serum or Plasma',
  '33914-3': 'Glomerular filtration rate/1.73 sq M.predicted',
  '2823-3': 'Potassium [Moles/volume] in Serum or Plasma',
  '2951-2': 'Sodium [Moles/volume] in Serum or Plasma',
  '2075-0': 'Chloride [Moles/volume] in Serum or Plasma',
  '1963-8': 'Bicarbonate [Moles/volume] in Serum or Plasma',
  // Labs — lipid panel
  '2093-3': 'Cholesterol [Mass/volume] in Serum or Plasma',
  '2571-8': 'Triglyceride [Mass/volume] in Serum or Plasma',
  '2085-9': 'Cholesterol in HDL [Mass/volume] in Serum or Plasma',
  '18262-6': 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by Direct assay',
  // Labs — thyroid
  '3016-3': 'Thyrotropin [Units/volume] in Serum or Plasma',
  // Labs — HbA1c
  '4548-4': 'Hemoglobin A1c/Hemoglobin.total in Blood',
  '17856-6': 'Hemoglobin A1c/Hemoglobin.total in Blood by HPLC',
  // Panels
  '24323-8': 'Comprehensive metabolic 2000 panel',
  '24357-6': 'Urinalysis macro panel',
  '58410-2': 'Complete blood count (CBC) panel',
  // Social history / functional
  '72166-2': 'Tobacco smoking status',
  '55757-9': 'Patient Health Questionnaire 2 item (PHQ-2)',
  '44249-1': 'PHQ-9 quick depression assessment panel',
};

// ── SNOMED CT embedded subset ─────────────────────────────────────────────────

const SNOMED_TABLE: Record<string, string> = {
  // Common conditions
  '44054006': 'Diabetes mellitus type 2',
  '73211009': 'Diabetes mellitus',
  '38341003': 'Hypertensive disorder',
  '13645005': 'Chronic obstructive lung disease',
  '195967001': 'Asthma',
  '53741008': 'Coronary arteriosclerosis',
  '22298006': 'Myocardial infarction',
  '230690007': 'Cerebrovascular accident',
  '40468003': 'Viral hepatitis',
  '363346000': 'Malignant neoplastic disease',
  '399068003': 'Prostate cancer',
  '254837009': 'Breast cancer',
  '93761005': 'Primary malignant neoplasm of colon',
  '69896004': 'Rheumatoid arthritis',
  '396275006': 'Osteoarthritis',
  '64859006': 'Osteoporosis',
  '271737000': 'Anemia',
  '49436004': 'Atrial fibrillation',
  '84114007': 'Heart failure',
  '57676002': 'Joint pain',
  '267036007': 'Dyspnoea',
  '422587007': 'Nausea',
  '62315008': 'Diarrhea',
  '25064002': 'Headache',
  '271807003': 'Skin eruption',
  // Procedures
  '71388002': 'Procedure',
  '182813001': 'Emergency treatment',
  '416940007': 'Past history of procedure',
  // Findings
  '160303001': 'Family history of ischemic heart disease',
  '160303002': 'Family history of diabetes mellitus',
  '415068001': 'Observation finding',
};

// ── RxNorm embedded subset ────────────────────────────────────────────────────

const RXNORM_TABLE: Record<string, string> = {
  '1049502': 'Hydrocodone 5 MG / Acetaminophen 325 MG Oral Tablet',
  '198440': 'Metformin 500 MG Oral Tablet',
  '854871': 'Atorvastatin 40 MG Oral Tablet',
  '429503': 'Lisinopril 10 MG Oral Tablet',
  '197361': 'Amlodipine 5 MG Oral Tablet',
  '309362': 'Clopidogrel 75 MG Oral Tablet',
  '311702': 'Aspirin 81 MG Oral Tablet',
  '197380': 'Metoprolol 25 MG Oral Tablet',
  '866514': 'Furosemide 20 MG Oral Tablet',
  '562250': 'Omeprazole 20 MG Delayed Release Oral Capsule',
  '597967': 'Sertraline 50 MG Oral Tablet',
  '476350': 'Gabapentin 300 MG Oral Capsule',
  '310964': 'Albuterol 0.09 MG/ACTUAT Metered Dose Inhaler',
  '628958': 'Insulin Glargine 100 UNT/ML Injectable Solution',
};

// ── Lookup function ────────────────────────────────────────────────────────────

/**
 * Look up a code in the embedded code system tables.
 * Returns CodeInfo if found, undefined if the code is not in the embedded subset.
 * NOTE: Only covers ~50-70 common codes per system — not a full terminology server.
 */
export function lookupCode(system: string, code: string): CodeInfo | undefined {
  let table: Record<string, string> | undefined;

  if (system === LOINC_SYSTEM) {
    table = LOINC_TABLE;
  } else if (system === SNOMED_SYSTEM) {
    table = SNOMED_TABLE;
  } else if (system === RXNORM_SYSTEM) {
    table = RXNORM_TABLE;
  }

  if (!table) return undefined;

  const display = table[code];
  if (!display) return undefined;

  return { system, code, display };
}

/**
 * Check if a code exists in the embedded subset.
 * Does NOT confirm the code is valid per the full terminology spec.
 */
export function isKnownCode(system: string, code: string): boolean {
  return lookupCode(system, code) !== undefined;
}

/**
 * Get all codes for a given system from the embedded table.
 */
export function getCodesForSystem(system: string): CodeInfo[] {
  let table: Record<string, string> | undefined;

  if (system === LOINC_SYSTEM) table = LOINC_TABLE;
  else if (system === SNOMED_SYSTEM) table = SNOMED_TABLE;
  else if (system === RXNORM_SYSTEM) table = RXNORM_TABLE;

  if (!table) return [];

  return Object.entries(table).map(([code, display]) => ({ system, code, display }));
}
