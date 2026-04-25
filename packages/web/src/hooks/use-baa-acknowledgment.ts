/**
 * useBaaAcknowledgment — quản lý trạng thái xác nhận BAA disclaimer.
 *
 * Lưu trạng thái vào localStorage với versioning để buộc re-acknowledge
 * khi nội dung disclaimer thay đổi đáng kể.
 *
 * Storage key: fhirbridge.baa.acknowledged.v1
 * Schema: { version: string; acknowledged: boolean; timestamp: number }
 */

import { useState, useCallback, useRef } from 'react';

/** Bump version khi nội dung disclaimer thay đổi đáng kể → buộc user re-ack */
const BAA_VERSION = 'v1';
const STORAGE_KEY = `fhirbridge.baa.acknowledged.${BAA_VERSION}`;

interface BaaRecord {
  version: string;
  acknowledged: boolean;
  timestamp: number;
}

/** Đọc trạng thái từ localStorage — trả về false nếu không tồn tại hoặc version lệch */
function readStoredAck(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const record = JSON.parse(raw) as BaaRecord;
    return record.version === BAA_VERSION && record.acknowledged === true;
  } catch {
    // Nếu parse lỗi (corrupted), coi như chưa ack
    return false;
  }
}

/** Ghi xác nhận vào localStorage */
function writeAck(acknowledged: boolean): void {
  const record: BaaRecord = {
    version: BAA_VERSION,
    acknowledged,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export interface UseBaaAcknowledgmentReturn {
  /** true nếu user đã xác nhận BAA disclaimer trên thiết bị này */
  acknowledged: boolean;
  /**
   * Mở modal disclaimer và chờ user xác nhận.
   * Trả về true nếu user đồng ý, false nếu hủy.
   * Nếu đã acknowledged từ trước → trả về true ngay lập tức (không mở modal).
   */
  requestAcknowledgment: () => Promise<boolean>;
  /** true khi modal đang mở */
  isModalOpen: boolean;
  /** Đóng modal (dùng nội bộ bởi BaaDisclaimerModal) */
  onConfirm: () => void;
  /** Hủy modal */
  onCancel: () => void;
}

/**
 * Hook quản lý BAA acknowledgment flow.
 *
 * @example
 * ```tsx
 * const baa = useBaaAcknowledgment();
 *
 * const handleGenerateAI = async () => {
 *   const ok = await baa.requestAcknowledgment();
 *   if (!ok) return;
 *   // tiếp tục generate...
 * };
 * ```
 */
export function useBaaAcknowledgment(): UseBaaAcknowledgmentReturn {
  // Khởi tạo từ localStorage
  const [acknowledged, setAcknowledged] = useState<boolean>(() => readStoredAck());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Promise resolver để await từ requestAcknowledgment()
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const requestAcknowledgment = useCallback((): Promise<boolean> => {
    // Nếu đã ack → không cần mở modal
    if (readStoredAck()) {
      setAcknowledged(true);
      return Promise.resolve(true);
    }

    // Mở modal và trả về Promise chờ user action
    setIsModalOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const onConfirm = useCallback(() => {
    writeAck(true);
    setAcknowledged(true);
    setIsModalOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const onCancel = useCallback(() => {
    setIsModalOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  return { acknowledged, requestAcknowledgment, isModalOpen, onConfirm, onCancel };
}
