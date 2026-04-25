/**
 * i18next TypeScript declaration merging.
 * Maps namespace → JSON structure so t() is type-safe.
 *
 * Pattern: https://www.i18next.com/overview/typescript
 */

import type viCommon from './locales/vi/common.json';
import type viConsent from './locales/vi/consent.json';
import type viBaa from './locales/vi/baa.json';
import type viSummary from './locales/vi/summary.json';
import type viErrors from './locales/vi/errors.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof viCommon;
      consent: typeof viConsent;
      baa: typeof viBaa;
      summary: typeof viSummary;
      errors: typeof viErrors;
    };
  }
}
