/**
 * ColumnMapper — maps source CSV/XLSX columns to FHIR path targets via dropdowns.
 */

import { cn } from '../../lib/utils';

export type ColumnMapping = Record<string, string>;

const FHIR_PATHS = [
  '',
  'Patient.id',
  'Patient.name.family',
  'Patient.name.given',
  'Patient.birthDate',
  'Patient.gender',
  'Patient.address.line',
  'Patient.address.city',
  'Patient.address.state',
  'Patient.address.postalCode',
  'Patient.telecom.phone',
  'Patient.telecom.email',
  'Condition.code.text',
  'Observation.code.text',
  'Observation.valueQuantity.value',
  'MedicationRequest.medication.text',
] as const;

interface Props {
  sourceColumns: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  className?: string;
}

export function ColumnMapper({ sourceColumns, mapping, onChange, className }: Props) {
  const handleChange = (col: string, fhirPath: string) => {
    onChange({ ...mapping, [col]: fhirPath });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 gap-x-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
        <span>Source Column</span>
        <span>FHIR Path</span>
      </div>
      <div className="space-y-1.5">
        {sourceColumns.map((col) => (
          <div key={col} className="grid grid-cols-2 items-center gap-x-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 truncate">
              {col}
            </div>
            <select
              value={mapping[col] ?? ''}
              onChange={(e) => handleChange(col, e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              aria-label={`Map ${col} to FHIR path`}
            >
              <option value="">— Skip —</option>
              {FHIR_PATHS.filter(Boolean).map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
