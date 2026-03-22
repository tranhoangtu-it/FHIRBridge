/**
 * ExportProgress — polls job status and shows a visual step-by-step progress display.
 */

import { useEffect } from 'react';
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { usePolling } from '../../hooks/use-polling';
import { exportApi, type ExportJob } from '../../api/export-api';
import { POLLING_INTERVAL_MS } from '../../lib/constants';

const STEPS = [
  { key: 'connecting', label: 'Connecting to source' },
  { key: 'fetching', label: 'Fetching patient data' },
  { key: 'mapping', label: 'Mapping to FHIR R4' },
  { key: 'bundling', label: 'Creating bundle' },
  { key: 'complete', label: 'Complete' },
] as const;

function progressToStep(progress: number): number {
  if (progress < 20) return 0;
  if (progress < 40) return 1;
  if (progress < 70) return 2;
  if (progress < 95) return 3;
  return 4;
}

interface Props {
  jobId: string;
  onComplete: (job: ExportJob) => void;
  onError: (message: string) => void;
}

export function ExportProgress({ jobId, onComplete, onError }: Props) {
  const { data: job, error } = usePolling(
    () => exportApi.getStatus(jobId),
    {
      interval: POLLING_INTERVAL_MS,
      enabled: true,
      shouldStop: (j) => j.status === 'complete' || j.status === 'error',
    },
  );

  useEffect(() => {
    if (!job) return;
    if (job.status === 'complete') onComplete(job);
    if (job.status === 'error') onError(job.error ?? 'Export failed');
  }, [job, onComplete, onError]);

  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  const currentStep = job ? progressToStep(job.progress) : 0;
  const progress = job?.progress ?? 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-primary-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {STEPS.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep && job?.status !== 'error';
          const isError = job?.status === 'error' && idx === currentStep;
          return (
            <li key={step.key} className="flex items-center gap-3">
              {isError ? (
                <AlertCircle className="h-5 w-5 text-red-500" aria-hidden />
              ) : done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden />
              ) : active ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" aria-hidden />
              )}
              <span
                className={cn(
                  'text-sm',
                  done
                    ? 'text-green-700 dark:text-green-400'
                    : active
                      ? 'font-medium text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-600',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {job?.status === 'error' && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {job.error ?? 'An error occurred during export'}
        </p>
      )}
    </div>
  );
}
