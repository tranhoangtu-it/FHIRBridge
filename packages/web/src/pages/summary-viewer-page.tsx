/**
 * SummaryViewerPage — generate and view AI summary for a given export ID.
 */

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { PageContainer } from '../components/layout/page-container';
import { SummaryConfig } from '../components/summary/summary-config';
import { SummaryDisplay } from '../components/summary/summary-display';
import { SummaryActions } from '../components/summary/summary-actions';
import { LoadingSpinner } from '../components/shared/loading-spinner';
import { usePolling } from '../hooks/use-polling';
import { summaryApi, type GenerateSummaryRequest, type SummaryJob } from '../api/summary-api';

type SummaryConfig_ = Omit<GenerateSummaryRequest, 'exportId'>;

const DEFAULT_CONFIG: SummaryConfig_ = {
  provider: 'openai',
  language: 'English',
  detailLevel: 'standard',
};

export function SummaryViewerPage() {
  const { id: exportId } = useParams<{ id: string }>();
  const [summaryConfig, setSummaryConfig] = useState<SummaryConfig_>(DEFAULT_CONFIG);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<SummaryJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handlePolledData = useCallback((job: SummaryJob) => {
    if (job.status === 'complete') setCompletedJob(job);
  }, []);

  usePolling(
    () => summaryApi.getStatus(pendingJobId!),
    {
      interval: 2000,
      enabled: !!pendingJobId && !completedJob,
      shouldStop: (j) => j.status === 'complete' || j.status === 'error',
    },
  );

  // Use polling result via effect — track via inline hook wrapping
  const { data: polledJob } = usePolling(
    () => summaryApi.getStatus(pendingJobId!),
    {
      interval: 2000,
      enabled: !!pendingJobId && !completedJob,
      shouldStop: (j) => j.status === 'complete' || j.status === 'error',
    },
  );

  // Sync polled data to state
  if (polledJob && polledJob !== completedJob && polledJob.status === 'complete') {
    setCompletedJob(polledJob);
    setPendingJobId(null);
  }

  const handleGenerate = async () => {
    if (!exportId) return;
    setGenerating(true);
    setGenError(null);
    setCompletedJob(null);
    try {
      const job = await summaryApi.generateSummary({ ...summaryConfig, exportId });
      setPendingJobId(job.id);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to start summary generation');
    } finally {
      setGenerating(false);
    }
  };

  // Suppress the double-hook — only the second usage matters for display
  void handlePolledData;

  return (
    <PageContainer
      title="Summary Viewer"
      description="Generate an AI-powered clinical summary for this export"
      actions={
        completedJob ? <SummaryActions summaryId={completedJob.id} /> : undefined
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Config */}
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Configuration</h2>
          <SummaryConfig value={summaryConfig} onChange={setSummaryConfig} disabled={generating || !!pendingJobId} />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || !!pendingJobId || !exportId}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? 'Starting…' : pendingJobId ? 'Generating…' : 'Generate Summary'}
            </button>
            {pendingJobId && !completedJob && <LoadingSpinner size="sm" label="Generating summary" />}
          </div>
          {genError && <p className="mt-2 text-sm text-red-600">{genError}</p>}
        </div>

        {/* Summary output */}
        {completedJob?.content && (
          <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
            <SummaryDisplay content={completedJob.content} />
          </div>
        )}

        {!exportId && (
          <p className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            No export ID provided. Navigate here from the Dashboard with a valid export.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
