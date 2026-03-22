/**
 * FHIR R4 Encounter resource type.
 * An interaction between a patient and healthcare provider(s).
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
  Coding,
} from './base-resource.js';

/** Encounter status values (FHIR R4) */
export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** Participant in the encounter */
export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

/** Diagnosis associated with the encounter */
export interface EncounterDiagnosis {
  condition: Reference;
  use?: CodeableConcept;
  rank?: number;
}

/** Hospitalization details */
export interface EncounterHospitalization {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference;
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference;
  dischargeDisposition?: CodeableConcept;
}

/**
 * FHIR R4 Encounter resource.
 * Required: status, class, subject (for clinical context).
 */
export interface Encounter extends DomainResource {
  readonly resourceType: 'Encounter';
  identifier?: Identifier[];
  /** Required: current state of the encounter */
  status: EncounterStatus;
  statusHistory?: Array<{ status: EncounterStatus; period: Period }>;
  /** Required: classification of patient encounter context */
  class: Coding;
  classHistory?: Array<{ class: Coding; period: Period }>;
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  /** Subject of the encounter — typically a Patient reference */
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: EncounterParticipant[];
  appointment?: Reference[];
  /** Time period of the encounter */
  period?: Period;
  length?: { value: number; unit: string; system?: string; code?: string };
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: EncounterDiagnosis[];
  account?: Reference[];
  hospitalization?: EncounterHospitalization;
  location?: Array<{ location: Reference; status?: string; period?: Period }>;
  serviceProvider?: Reference;
  partOf?: Reference;
}
