/**
 * @fhirbridge/core — validators barrel export.
 */

export { validateResource, patterns } from './resource-validator.js';
export { validatePatient } from './patient-validator.js';
export { validateCoding, validateCodeableConcept } from './coding-validator.js';
export { validateReference, validateReferenceInBundle } from './reference-validator.js';

// Newly added resource validators (5 MVP resources)
export { validateMedication } from './medication-validator.js';
export { validatePractitioner } from './practitioner-validator.js';
export { validateDocumentReference } from './document-reference-validator.js';
export { validateCarePlan } from './care-plan-validator.js';
export { validateCareTeam } from './care-team-validator.js';

// Sprint 4: Immunization + Specimen validators
export { validateImmunization } from './immunization-validator.js';
export { validateSpecimen } from './specimen-validator.js';
