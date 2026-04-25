/**
 * FHIR R4 Practitioner resource type.
 * Represents a healthcare provider involved in patient care.
 * Spec: https://hl7.org/fhir/R4/practitioner.html
 *
 * Được tham chiếu bởi Encounter.participant, MedicationRequest.requester, v.v.
 */

import type {
  DomainResource,
  Identifier,
  HumanName,
  ContactPoint,
  Address,
  CodeableConcept,
  Reference,
  Period,
  Attachment,
} from './base-resource.js';

/** Giới tính hành chính — dùng lại từ Patient spec */
export type PractitionerGender = 'male' | 'female' | 'other' | 'unknown';

/** Bằng cấp/chứng chỉ chuyên môn của nhân viên y tế */
export interface PractitionerQualification {
  identifier?: Identifier[];
  /** Loại bằng cấp — ví dụ: MD, RN, PharmD (v3.RoleCode) */
  code: CodeableConcept;
  period?: Period;
  /** Tổ chức cấp bằng (tham chiếu đến Organization) */
  issuer?: Reference;
}

/**
 * FHIR R4 Practitioner resource.
 * Must-support: identifier, name, telecom, qualification.
 * Required per spec: resourceType (base).
 */
export interface Practitioner extends DomainResource {
  readonly resourceType: 'Practitioner';
  identifier?: Identifier[];
  /** Đang hoạt động trong hệ thống hay không */
  active?: boolean;
  /** Tên nhân viên y tế — ít nhất một phần tử được khuyến nghị */
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  /** Giới tính hành chính */
  gender?: PractitionerGender;
  /** Ngày sinh (ISO 8601 YYYY-MM-DD) */
  birthDate?: string;
  /** Ảnh đại diện */
  photo?: Attachment[];
  /** Danh sách bằng cấp và chứng chỉ */
  qualification?: PractitionerQualification[];
  /** Ngôn ngữ giao tiếp */
  communication?: CodeableConcept[];
}
