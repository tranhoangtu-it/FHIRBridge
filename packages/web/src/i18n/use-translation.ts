/**
 * Typed wrapper around react-i18next's useTranslation.
 *
 * Cung cấp type-safe t() và i18n instance.
 * Import hook này thay vì useTranslation trực tiếp để đảm bảo
 * namespace luôn được type-check theo i18next-resources.d.ts.
 */

import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { CustomTypeOptions } from 'i18next';

/** Namespace hợp lệ — lấy từ CustomTypeOptions để single source of truth */
export type I18nNamespace = keyof CustomTypeOptions['resources'];

/**
 * useTranslation — typed wrapper.
 *
 * @param ns - namespace, mặc định 'common'
 *
 * @example
 * const { t } = useTranslation('consent');
 * t('modal.accept_button') // type-safe
 */
export function useTranslation(ns: I18nNamespace = 'common') {
  return useI18nextTranslation(ns);
}

/**
 * useI18n — truy cập i18n instance để đổi ngôn ngữ.
 *
 * @example
 * const { i18n } = useI18n();
 * i18n.changeLanguage('en');
 */
export function useI18n() {
  const { i18n } = useI18nextTranslation();
  return { i18n };
}
