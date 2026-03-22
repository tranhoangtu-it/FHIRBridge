/**
 * ConnectorForm — FHIR endpoint configuration inputs.
 */

import { cn } from '../../lib/utils';

export interface ConnectorConfig {
  url: string;
  clientId: string;
  clientSecret: string;
}

interface Props {
  value: ConnectorConfig;
  onChange: (cfg: ConnectorConfig) => void;
  onTest?: () => void;
  testResult?: { success: boolean; message: string } | null;
  testing?: boolean;
  className?: string;
}

export function ConnectorForm({ value, onChange, onTest, testResult, testing, className }: Props) {
  const set = (key: keyof ConnectorConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <label htmlFor="fhir-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          FHIR Server URL <span className="text-red-500">*</span>
        </label>
        <input
          id="fhir-url"
          type="url"
          placeholder="https://fhir.example.com/r4"
          value={value.url}
          onChange={set('url')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="client-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client ID
        </label>
        <input
          id="client-id"
          type="text"
          placeholder="Optional — for SMART on FHIR"
          value={value.clientId}
          onChange={set('clientId')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="client-secret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Secret
        </label>
        <input
          id="client-secret"
          type="password"
          placeholder="Optional"
          value={value.clientSecret}
          onChange={set('clientSecret')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoComplete="new-password"
        />
      </div>

      {onTest && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTest}
            disabled={!value.url || testing}
            className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={cn('text-sm', testResult.success ? 'text-green-600' : 'text-red-600')}>
              {testResult.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
