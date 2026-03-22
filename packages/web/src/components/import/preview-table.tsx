/**
 * PreviewTable — displays first 10 rows of uploaded tabular data.
 */

import { cn } from '../../lib/utils';

interface Props {
  columns: string[];
  rows: Record<string, string>[];
  className?: string;
}

export function PreviewTable({ columns, rows, className }: Props) {
  const previewRows = rows.slice(0, 10);

  if (columns.length === 0) return null;

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {previewRows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {columns.map((col) => (
                <td
                  key={col}
                  className="max-w-[200px] truncate px-4 py-2 text-gray-700 dark:text-gray-300"
                  title={row[col]}
                >
                  {row[col] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
          Showing 10 of {rows.length} rows
        </p>
      )}
    </div>
  );
}
