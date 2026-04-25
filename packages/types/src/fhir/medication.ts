/**
 * FHIR R4 Medication resource type.
 * Represents a medication used in the treatment of a patient.
 * Spec: https://hl7.org/fhir/R4/medication.html
 *
 * Thường được tham chiếu bởi MedicationRequest.medicationReference.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Ratio,
} from './base-resource.js';

/** Trạng thái của thuốc trong hệ thống (FHIR R4 §10.4.1) */
export type MedicationStatus = 'active' | 'inactive' | 'entered-in-error';

/** Thành phần cấu tạo thuốc */
export interface MedicationIngredient {
  /** Tên/code thành phần — SNOMED CT hoặc RxNorm */
  itemCodeableConcept?: CodeableConcept;
  /** Tham chiếu đến Substance hoặc Medication khác */
  itemReference?: Reference;
  /** Đây có phải thành phần hoạt chất không */
  isActive?: boolean;
  /** Lượng thành phần trong công thức */
  strength?: Ratio;
}

/** Thông tin lô thuốc */
export interface MedicationBatch {
  /** Số lô sản xuất */
  lotNumber?: string;
  /** Ngày hết hạn (ISO 8601 YYYY-MM-DD) */
  expirationDate?: string;
}

/**
 * FHIR R4 Medication resource.
 * Must-support: code (RxNorm/SNOMED), status, form, ingredient.
 * Required per spec: resourceType (base).
 */
export interface Medication extends DomainResource {
  readonly resourceType: 'Medication';
  identifier?: Identifier[];
  /** Mã thuốc — ưu tiên RxNorm (http://www.nlm.nih.gov/research/umls/rxnorm) */
  code?: CodeableConcept;
  /** Trạng thái thuốc trong danh mục */
  status?: MedicationStatus;
  /** Nhà sản xuất (tham chiếu đến Organization) */
  manufacturer?: Reference;
  /** Dạng bào chế: viên, nang, dung dịch, v.v. */
  form?: CodeableConcept;
  /** Lượng thuốc trong một đơn vị đóng gói */
  amount?: Ratio;
  /** Danh sách thành phần */
  ingredient?: MedicationIngredient[];
  /** Thông tin lô sản xuất */
  batch?: MedicationBatch;
}
