/**
 * LoadingSpinner — accessible activity indicator.
 */

import { cn } from '../../lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md', className, label = 'Loading…' }: Props) {
  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label={label}>
      <div
        className={cn(
          'animate-spin rounded-full border-primary-200 border-t-primary-600',
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
