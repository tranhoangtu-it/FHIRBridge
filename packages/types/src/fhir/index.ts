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

export type { Condition, ConditionEvidence, ConditionStage } from './condition.js';

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

export type {
  Medication,
  MedicationStatus,
  MedicationIngredient,
  MedicationBatch,
} from './medication.js';

export type {
  Practitioner,
  PractitionerGender,
  PractitionerQualification,
} from './practitioner.js';

export type {
  DocumentReference,
  DocumentReferenceStatus,
  DocumentReferenceDocStatus,
  DocumentReferenceContent,
  DocumentReferenceContext,
} from './document-reference.js';

export type {
  CarePlan,
  CarePlanStatus,
  CarePlanIntent,
  CarePlanActivityStatus,
  CarePlanActivity,
  CarePlanActivityDetail,
} from './care-plan.js';

export type { CareTeam, CareTeamStatus, CareTeamParticipant } from './care-team.js';

export type {
  Immunization,
  ImmunizationStatus,
  ImmunizationPerformer,
  ImmunizationProtocolApplied,
} from './immunization.js';

export type {
  Specimen,
  SpecimenStatus,
  SpecimenCollection,
  SpecimenProcessing,
  SpecimenContainer,
} from './specimen.js';

// Expose newly added base types for downstream use
export type { Ratio, Attachment } from './base-resource.js';
