/**
 * SummaryDisplay — renders AI-generated markdown with section navigation.
 * Includes mandatory AI disclaimer.
 */

import ReactMarkdown from 'react-markdown';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  content: string;
  className?: string;
}

export function SummaryDisplay({ content, className }: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* AI Disclaimer — always visible */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-700/50 dark:bg-yellow-900/20"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" aria-hidden />
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          <strong>AI-generated summary</strong> — This content is produced by an AI model and may
          contain errors. Always verify clinical information with a qualified healthcare provider.
        </p>
      </div>

      {/* Rendered markdown */}
      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:text-base prose-h3:text-sm">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
