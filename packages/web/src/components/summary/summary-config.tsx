/**
 * SummaryConfig — selects AI provider, language, and detail level for summary generation.
 */

import { cn } from '../../lib/utils';
import type { GenerateSummaryRequest } from '../../api/summary-api';

type Config = Omit<GenerateSummaryRequest, 'exportId'>;

const PROVIDERS = ['openai', 'anthropic', 'google'] as const;
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese'] as const;
const DETAIL_LEVELS = ['brief', 'standard', 'detailed'] as const;

interface Props {
  value: Config;
  onChange: (cfg: Config) => void;
  disabled?: boolean;
  className?: string;
}

function Select({
  id, label, value, options, onChange, disabled,
}: {
  id: string; label: string; value: string;
  options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}

export function SummaryConfig({ value, onChange, disabled, className }: Props) {
  const set = (key: keyof Config) => (v: string) =>
    onChange({ ...value, [key]: v } as Config);

  return (
    <div className={cn('grid gap-4 sm:grid-cols-3', className)}>
      <Select id="provider" label="AI Provider" value={value.provider} options={PROVIDERS} onChange={set('provider')} disabled={disabled} />
      <Select id="language" label="Language" value={value.language} options={LANGUAGES} onChange={set('language')} disabled={disabled} />
      <Select id="detail" label="Detail Level" value={value.detailLevel} options={DETAIL_LEVELS} onChange={set('detailLevel')} disabled={disabled} />
    </div>
  );
}
