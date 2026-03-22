/**
 * @fhirbridge/types — FHIR R4 type definitions barrel export.
 * Exports all resource-specific interfaces and common data types.
 */

export type {
  // Common data types
  Resource,
  DomainResource,
  Reference,
  CodeableConcept,
  Coding,
  HumanName,
  Address,
  ContactPoint,
  Period,
  Identifier,
  Meta,
  Narrative,
  Extension,
  Quantity,
  Dosage,
  // Validation types
  ValidationError,
  ValidationResult,
  ValidationSeverity,
} from './base-resource.js';

export type { Patient, AdministrativeGender, PatientLink, PatientContact } from './patient.js';

export type {
  Encounter,
  EncounterStatus,
  EncounterParticipant,
  EncounterDiagnosis,
  EncounterHospitalization,
} from './encounter.js';

export type {
  Condition,
  ConditionEvidence,
  ConditionStage,
} from './condition.js';

export type {
  Observation,
  ObservationStatus,
  ObservationCategory,
  ObservationComponent,
  ObservationReferenceRange,
} from './observation.js';

export type {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestIntent,
  MedicationDispenseRequest,
  MedicationSubstitution,
} from './medication-request.js';

export type {
  AllergyIntolerance,
  AllergyIntoleranceClinicalStatus,
  AllergyIntoleranceVerificationStatus,
  AllergyIntoleranceType,
  AllergyIntoleranceCategory,
  AllergyIntoleranceCriticality,
  AllergyIntoleranceReaction,
} from './allergy-intolerance.js';

export type {
  Procedure,
  ProcedureStatus,
  ProcedurePerformer,
  ProcedureFocalDevice,
} from './procedure.js';

export type {
  DiagnosticReport,
  DiagnosticReportStatus,
  DiagnosticReportMedia,
} from './diagnostic-report.js';

export type {
  Bundle,
  BundleEntry,
  BundleType,
  BundleLink,
  BundleEntryRequest,
  BundleEntryResponse,
  BundleEntrySearch,
  BundleEntrySearchMode,
} from './bundle.js';
