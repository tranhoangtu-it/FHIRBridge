/**
 * StatusBadge — coloured pill for export/summary status values.
 */

import { cn } from '../../lib/utils';

type Status = 'pending' | 'running' | 'generating' | 'complete' | 'error' | string;

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  generating: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface Props {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
