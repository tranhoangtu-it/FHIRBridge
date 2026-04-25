/**
 * FHIR R4 Immunization resource type definitions.
 * Spec: https://hl7.org/fhir/R4/immunization.html
 *
 * Dùng để lưu thông tin tiêm chủng của bệnh nhân (vaccine COVID-19, cúm, viêm gan B, v.v.)
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Quantity,
} from './base-resource.js';

/** Trạng thái tiêm chủng (FHIR R4 §Immunization.status) */
export type ImmunizationStatus = 'completed' | 'entered-in-error' | 'not-done';

/**
 * Người thực hiện tiêm chủng (FHIR R4 §Immunization.performer)
 * Bao gồm vai trò (function) và tham chiếu đến practitioner/organization
 */
export interface ImmunizationPerformer {
  /** Vai trò của người thực hiện (AP = Administering Provider) */
  function?: CodeableConcept;
  /** Tham chiếu đến Practitioner hoặc Organization */
  actor: Reference;
}

/**
 * Thông tin lịch tiêm chủng được áp dụng (FHIR R4 §Immunization.protocolApplied)
 */
export interface ImmunizationProtocolApplied {
  /** Tên chuỗi tiêm chủng, ví dụ "COVID-19 2-dose series" */
  series?: string;
  /** Số thứ tự liều trong chuỗi (positive integer) */
  doseNumberPositiveInt?: number;
  /** Tổng số liều trong chuỗi (positive integer) */
  seriesDosesPositiveInt?: number;
}

/**
 * FHIR R4 Immunization resource.
 * Ghi nhận việc tiêm vaccine cho bệnh nhân.
 *
 * Choice type: occurrence[x] — phải có đúng một trong hai:
 *   - occurrenceDateTime: chuỗi ISO 8601 datetime
 *   - occurrenceString: mô tả dạng văn bản (khi không biết ngày chính xác)
 *
 * Spec: https://hl7.org/fhir/R4/immunization.html
 */
export interface Immunization extends DomainResource {
  readonly resourceType: 'Immunization';

  /** Các mã định danh nội bộ của HIS (optional) */
  identifier?: Identifier[];

  /**
   * Trạng thái tiêm chủng.
   * completed = đã tiêm; not-done = chỉ định nhưng không tiêm; entered-in-error = nhập nhầm
   */
  status: ImmunizationStatus;

  /** Lý do không tiêm (required khi status = not-done) */
  statusReason?: CodeableConcept;

  /**
   * Mã vaccine.
   * Ưu tiên dùng CVX (http://hl7.org/fhir/sid/cvx) cho US,
   * hoặc SNOMED CT cho quốc tế / Việt Nam
   */
  vaccineCode: CodeableConcept;

  /** Bệnh nhân được tiêm (phải là Reference đến Patient resource) */
  patient: Reference;

  /** Lần khám liên quan (optional) */
  encounter?: Reference;

  /** Thời điểm tiêm — ISO 8601 datetime (choice[x], xem occurrenceString) */
  occurrenceDateTime?: string;

  /**
   * Thời điểm tiêm dưới dạng văn bản khi không rõ ngày chính xác.
   * Choice[x]: chỉ dùng khi không có occurrenceDateTime
   */
  occurrenceString?: string;

  /** Thời điểm ghi nhận vào EHR (có thể khác ngày tiêm) */
  recorded?: string;

  /**
   * true = thông tin từ nguồn gốc trực tiếp (bác sĩ, y tá).
   * false/absent = thông tin do bệnh nhân tự khai
   */
  primarySource?: boolean;

  /** Nhà sản xuất vaccine */
  manufacturer?: Reference;

  /** Số lô vaccine (lot number) */
  lotNumber?: string;

  /** Hạn dùng vaccine (YYYY-MM-DD) */
  expirationDate?: string;

  /**
   * Vị trí giải phẫu tiêm vaccine.
   * Ví dụ: cánh tay trái (SNOMED CT: 368209003)
   */
  site?: CodeableConcept;

  /**
   * Đường dùng (route of administration).
   * Ví dụ: tiêm bắp (SNOMED CT: 78421000)
   */
  route?: CodeableConcept;

  /** Liều lượng vaccine được tiêm */
  doseQuantity?: Quantity;

  /** Danh sách người thực hiện tiêm (bác sĩ, y tá, tổ chức) */
  performer?: ImmunizationPerformer[];

  /** Thông tin về lịch tiêm chủng được áp dụng */
  protocolApplied?: ImmunizationProtocolApplied[];
}
