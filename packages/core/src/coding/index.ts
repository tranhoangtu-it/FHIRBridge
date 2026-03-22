/**
 * @fhirbridge/core — coding utilities barrel export.
 */

export {
  LOINC_SYSTEM,
  SNOMED_SYSTEM,
  RXNORM_SYSTEM,
  ICD10_CM_SYSTEM,
  ICD10_PCS_SYSTEM,
  CPT_SYSTEM,
  HL7_ACT_CODE_SYSTEM,
  CONDITION_CLINICAL_SYSTEM,
  CONDITION_VER_STATUS_SYSTEM,
  ALLERGY_CLINICAL_SYSTEM,
  ALLERGY_VER_STATUS_SYSTEM,
  OBSERVATION_CATEGORY_SYSTEM,
  KNOWN_SYSTEMS,
} from './code-systems.js';

export type { CodeInfo } from './code-system-lookup.js';
export { lookupCode, isKnownCode, getCodesForSystem } from './code-system-lookup.js';
