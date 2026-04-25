/**
 * i18n setup — i18next + react-i18next + browser language detector.
 *
 * Chiến lược:
 * - VI loaded eagerly (default locale)
 * - EN / JA lazy-loaded khi user switch
 * - Detect order: localStorage → navigator → 'vi' fallback
 * - Namespace per file: common | consent | baa | summary | errors
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ---------------------------------------------------------------------------
// VI bundles — loaded eagerly so first paint has no flicker
// ---------------------------------------------------------------------------
import viCommon from './locales/vi/common.json';
import viConsent from './locales/vi/consent.json';
import viBaa from './locales/vi/baa.json';
import viSummary from './locales/vi/summary.json';
import viErrors from './locales/vi/errors.json';

// ---------------------------------------------------------------------------
// EN bundles — loaded eagerly alongside VI (small payload, avoids async gap)
// ---------------------------------------------------------------------------
import enCommon from './locales/en/common.json';
import enConsent from './locales/en/consent.json';
import enBaa from './locales/en/baa.json';
import enSummary from './locales/en/summary.json';
import enErrors from './locales/en/errors.json';

// ---------------------------------------------------------------------------
// JA bundles — placeholder content (VI text). Full translation in v1.1.
// ---------------------------------------------------------------------------
import jaCommon from './locales/ja/common.json';
import jaConsent from './locales/ja/consent.json';
import jaBaa from './locales/ja/baa.json';
import jaSummary from './locales/ja/summary.json';
import jaErrors from './locales/ja/errors.json';

// ---------------------------------------------------------------------------
// Supported locales
// ---------------------------------------------------------------------------
export const SUPPORTED_LANGUAGES = ['vi', 'en', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Detect order: localStorage key 'i18nextLng' → browser navigator → fallback
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'fhirbridge.lang',
    },

    fallbackLng: 'vi',
    supportedLngs: SUPPORTED_LANGUAGES,

    defaultNS: 'common',
    ns: ['common', 'consent', 'baa', 'summary', 'errors'],

    resources: {
      vi: {
        common: viCommon,
        consent: viConsent,
        baa: viBaa,
        summary: viSummary,
        errors: viErrors,
      },
      en: {
        common: enCommon,
        consent: enConsent,
        baa: enBaa,
        summary: enSummary,
        errors: enErrors,
      },
      ja: {
        common: jaCommon,
        consent: jaConsent,
        baa: jaBaa,
        summary: jaSummary,
        errors: jaErrors,
      },
    },

    interpolation: {
      // React đã escape — không cần i18next escape thêm
      escapeValue: false,
    },

    // Không suspense — resources đã bundled sẵn
    react: {
      useSuspense: false,
    },
  });

export default i18n;
