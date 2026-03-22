/**
 * PageContainer — max-width content wrapper with consistent padding.
 */

import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function PageContainer({ children, className, title, description, actions }: Props) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-6 py-6', className)}>
      {(title || actions) && (
        <div className="mb-6 flex items-start justify-between">
          <div>
            {title && (
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
