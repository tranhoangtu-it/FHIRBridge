/**
 * FHIR R4 Specimen resource type definitions.
 * Spec: https://hl7.org/fhir/R4/specimen.html
 *
 * Dùng để theo dõi mẫu bệnh phẩm (máu, nước tiểu, mô, v.v.)
 * trong quy trình xét nghiệm — liên kết với DiagnosticReport và Observation.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Quantity,
} from './base-resource.js';

/** Trạng thái mẫu bệnh phẩm (FHIR R4 §Specimen.status) */
export type SpecimenStatus = 'available' | 'unavailable' | 'unsatisfactory' | 'entered-in-error';

/**
 * Thông tin thu thập mẫu (FHIR R4 §Specimen.collection)
 */
export interface SpecimenCollection {
  /** Người thu thập mẫu (Practitioner reference) */
  collector?: Reference;
  /** Thời điểm thu thập — ISO 8601 datetime */
  collectedDateTime?: string;
  /** Thể tích / khối lượng mẫu thu thập */
  quantity?: Quantity;
  /** Phương pháp thu thập (ví dụ: venipuncture, swab) */
  method?: CodeableConcept;
  /** Vị trí giải phẫu lấy mẫu (ví dụ: tĩnh mạch cánh tay) */
  bodySite?: CodeableConcept;
}

/**
 * Bước xử lý mẫu (FHIR R4 §Specimen.processing)
 * Ví dụ: ly tâm, bảo quản lạnh, nhuộm tế bào
 */
export interface SpecimenProcessing {
  /** Mô tả bước xử lý */
  description?: string;
  /** Quy trình xử lý (SNOMED CT procedure code) */
  procedure?: CodeableConcept;
  /** Hóa chất / chất phụ gia dùng trong bước xử lý */
  additive?: Reference[];
  /** Thời điểm thực hiện bước xử lý — ISO 8601 datetime */
  timeDateTime?: string;
}

/**
 * Container chứa mẫu (FHIR R4 §Specimen.container)
 * Ví dụ: ống máu EDTA (tím), ống máu SST (vàng)
 */
export interface SpecimenContainer {
  /** Mã định danh của container (barcode, số lô) */
  identifier?: Identifier[];
  /** Mô tả container */
  description?: string;
  /** Loại container (SNOMED CT container type code) */
  type?: CodeableConcept;
  /** Dung tích tối đa của container */
  capacity?: Quantity;
  /** Thể tích mẫu hiện có trong container */
  specimenQuantity?: Quantity;
  /** Chất phụ gia trong container (dưới dạng CodeableConcept) */
  additiveCodeableConcept?: CodeableConcept;
}

/**
 * FHIR R4 Specimen resource.
 * Đại diện cho mẫu bệnh phẩm được thu thập và xử lý trong phòng xét nghiệm.
 *
 * Spec: https://hl7.org/fhir/R4/specimen.html
 */
export interface Specimen extends DomainResource {
  readonly resourceType: 'Specimen';

  /** Các mã định danh nội bộ (số mẫu, barcode HIS) */
  identifier?: Identifier[];

  /**
   * Mã số tiếp nhận tại phòng xét nghiệm.
   * Thường là mã barcode dán trên ống mẫu
   */
  accessionIdentifier?: Identifier;

  /**
   * Trạng thái của mẫu.
   * available = sẵn có; unavailable = không khả dụng; unsatisfactory = không đạt chất lượng
   */
  status?: SpecimenStatus;

  /**
   * Loại mẫu bệnh phẩm.
   * Dùng SNOMED CT (ví dụ: 119297000 = Blood specimen, 122575003 = Urine specimen)
   */
  type?: CodeableConcept;

  /** Bệnh nhân / đối tượng cung cấp mẫu */
  subject?: Reference;

  /** Thời điểm nhận mẫu tại phòng xét nghiệm — ISO 8601 datetime */
  receivedTime?: string;

  /**
   * Mẫu gốc (nếu đây là mẫu dẫn xuất / aliquot).
   * Ví dụ: mẫu huyết thanh dẫn xuất từ máu toàn phần
   */
  parent?: Reference[];

  /**
   * Yêu cầu xét nghiệm liên quan (ServiceRequest references).
   * Cho phép truy nguyên từ mẫu về y lệnh
   */
  request?: Reference[];

  /** Thông tin thu thập mẫu */
  collection?: SpecimenCollection;

  /** Danh sách các bước xử lý mẫu */
  processing?: SpecimenProcessing[];

  /** Thông tin về container/ống chứa mẫu */
  container?: SpecimenContainer[];
}
