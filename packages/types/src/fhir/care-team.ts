/**
 * FHIR R4 CareTeam resource type.
 * Represents the care team — all practitioners and organizations involved in care.
 * Spec: https://hl7.org/fhir/R4/careteam.html
 *
 * Use case: nhóm điều trị đa chuyên khoa, gắn với CarePlan.careTeam.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
  ContactPoint,
} from './base-resource.js';

/** Trạng thái đội điều trị (FHIR R4 §12.15.1.2) */
export type CareTeamStatus = 'proposed' | 'active' | 'suspended' | 'inactive' | 'entered-in-error';

/** Một thành viên trong đội điều trị */
export interface CareTeamParticipant {
  /** Vai trò của thành viên — ví dụ: bác sĩ điều trị, điều dưỡng, dược sĩ */
  role?: CodeableConcept[];
  /** Thành viên — tham chiếu đến Practitioner, Patient, RelatedPerson, Organization */
  member?: Reference;
  /** Tổ chức thay mặt thành viên tham gia */
  onBehalfOf?: Reference;
  /** Khoảng thời gian tham gia */
  period?: Period;
}

/**
 * FHIR R4 CareTeam resource.
 * Must-support: status, subject, participant.
 * Required per spec: resourceType (base).
 */
export interface CareTeam extends DomainResource {
  readonly resourceType: 'CareTeam';
  identifier?: Identifier[];
  /** Trạng thái đội điều trị */
  status?: CareTeamStatus;
  /** Phân loại đội (ví dụ: longitudinal, episode) */
  category?: CodeableConcept[];
  /** Tên đội điều trị */
  name?: string;
  /** Bệnh nhân được chăm sóc */
  subject?: Reference;
  /** Cuộc gặp liên quan */
  encounter?: Reference;
  /** Khoảng thời gian hoạt động của đội */
  period?: Period;
  /** Danh sách thành viên */
  participant?: CareTeamParticipant[];
  /** Vấn đề/chẩn đoán được giải quyết */
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  /** Tổ chức quản lý đội */
  managingOrganization?: Reference[];
  /** Thông tin liên lạc đội */
  telecom?: ContactPoint[];
  note?: Array<{ text: string }>;
}
