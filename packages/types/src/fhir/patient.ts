/**
 * FHIR R4 Patient resource type.
 * Represents demographics and administrative information about a person receiving care.
 */

import type {
  DomainResource,
  HumanName,
  Identifier,
  Address,
  ContactPoint,
  CodeableConcept,
  Reference,
  Period,
} from './base-resource.js';

/** Supported administrative gender values (FHIR R4) */
export type AdministrativeGender = 'male' | 'female' | 'other' | 'unknown';

/** Link to another Patient resource that refers to the same individual */
export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

/** Contact party for the patient */
export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: AdministrativeGender;
  organization?: Reference;
  period?: Period;
}

/**
 * FHIR R4 Patient resource.
 * Required fields per R4 spec: resourceType (inherited), name[0].family for identification.
 */
export interface Patient extends DomainResource {
  readonly resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  /** Administrative gender — required for most clinical uses */
  gender?: AdministrativeGender;
  /** Date of birth in YYYY-MM-DD format */
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  contact?: PatientContact[];
  communication?: Array<{
    language: CodeableConcept;
    preferred?: boolean;
  }>;
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}
