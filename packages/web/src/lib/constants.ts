/**
 * Application-wide constants — API base URL and client-side route paths.
 */

export const API_BASE_URL: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? '/api';

export const ROUTES = {
  DASHBOARD: '/',
  EXPORT: '/export',
  IMPORT: '/import',
  SUMMARY: '/summary/:id',
  SUMMARY_VIEW: (id: string) => `/summary/${id}`,
  SETTINGS: '/settings',
} as const;

export const POLLING_INTERVAL_MS = 2000;
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
};
