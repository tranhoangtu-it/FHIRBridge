/**
 * FHIR R4 DocumentReference resource type.
 * References a clinical document such as a discharge summary or lab report PDF.
 * Spec: https://hl7.org/fhir/R4/documentreference.html
 *
 * Use case chính trong FHIRBridge: xuất tóm tắt xuất viện, kết quả xét nghiệm PDF.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Coding,
  Reference,
  Period,
  Attachment,
} from './base-resource.js';

/** Trạng thái tài liệu (FHIR R4 §3.3.1) */
export type DocumentReferenceStatus = 'current' | 'superseded' | 'entered-in-error';

/** Trạng thái nội dung tài liệu lâm sàng */
export type DocumentReferenceDocStatus = 'preliminary' | 'final' | 'amended' | 'entered-in-error';

/** Một phiên bản nội dung tài liệu và định dạng của nó */
export interface DocumentReferenceContent {
  /** Tệp đính kèm thực tế (URL hoặc base64 data) */
  attachment: Attachment;
  /** Định dạng/hồ sơ tài liệu — IHE format codes */
  format?: Coding;
}

/** Ngữ cảnh lâm sàng của tài liệu */
export interface DocumentReferenceContext {
  /** Cuộc gặp liên quan */
  encounter?: Reference[];
  /** Sự kiện lâm sàng được ghi lại */
  event?: CodeableConcept[];
  /** Khoảng thời gian dịch vụ */
  period?: Period;
  /** Loại cơ sở chăm sóc (FHIR valueset-c80-facilitycodes) */
  facilityType?: CodeableConcept;
  /** Chuyên khoa liên quan */
  practiceSetting?: CodeableConcept;
  /** Bệnh nhân trong ngữ cảnh */
  sourcePatientInfo?: Reference;
  /** Tài liệu liên quan */
  related?: Reference[];
}

/**
 * FHIR R4 DocumentReference resource.
 * Required: status, content[].attachment.
 * Must-support: type (LOINC), subject, author, content.
 */
export interface DocumentReference extends DomainResource {
  readonly resourceType: 'DocumentReference';
  /** Định danh chính (master) — thường là OID hoặc số tài liệu */
  masterIdentifier?: Identifier;
  identifier?: Identifier[];
  /** Trạng thái tài liệu — bắt buộc */
  status: DocumentReferenceStatus;
  /** Trạng thái nội dung lâm sàng */
  docStatus?: DocumentReferenceDocStatus;
  /**
   * Loại tài liệu — ưu tiên mã LOINC
   * Ví dụ: 18842-5 (Discharge summary), 11502-2 (Laboratory report)
   */
  type?: CodeableConcept;
  /** Danh mục tài liệu */
  category?: CodeableConcept[];
  /** Bệnh nhân là chủ thể tài liệu */
  subject?: Reference;
  /** Thời điểm tạo/ghi nhận tài liệu (ISO 8601 datetime) */
  date?: string;
  /** Tác giả tài liệu */
  author?: Reference[];
  /** Người xác nhận nội dung (authenticator) */
  authenticator?: Reference;
  /** Tổ chức lưu trữ tài liệu */
  custodian?: Reference;
  /** Quan hệ với tài liệu khác (thay thế, thêm vào, v.v.) */
  relatesTo?: Array<{
    /** 'replaces' | 'transforms' | 'signs' | 'appends' */
    code: string;
    target: Reference;
  }>;
  /** Mô tả ngắn về nội dung tài liệu */
  description?: string;
  /** Nhãn bảo mật */
  securityLabel?: CodeableConcept[];
  /** Nội dung tài liệu — bắt buộc ít nhất một phần tử */
  content: DocumentReferenceContent[];
  /** Ngữ cảnh lâm sàng */
  context?: DocumentReferenceContext;
}
