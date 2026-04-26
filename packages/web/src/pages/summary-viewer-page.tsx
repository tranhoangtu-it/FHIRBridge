/**
 * SummaryViewerPage — generate and view AI summary for a given export ID.
 *
 * Fix C-14: removed duplicate usePolling call; single poll with:
 *  - correct dependency array (pendingJobId, completedJob)
 *  - 5-minute max polling timeout
 *  - AbortController cleanup on unmount
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { PageContainer } from '../components/layout/page-container';
import { SummaryConfig } from '../components/summary/summary-config';
import { SummaryDisplay } from '../components/summary/summary-display';
import { SummaryActions } from '../components/summary/summary-actions';
import { LoadingSpinner } from '../components/shared/loading-spinner';
import { usePolling } from '../hooks/use-polling';
import { summaryApi, type GenerateSummaryRequest, type SummaryJob } from '../api/summary-api';
import { CrossBorderConsentModal } from '../components/consent';
import { useConsent } from '../hooks/use-consent';
import { BaaDisclaimerModal } from '../components/baa';
import { useBaaAcknowledgment } from '../hooks/use-baa-acknowledgment';

/** Feature flag — AI chỉ bật nếu VITE_AI_ENABLED=true. Hosted SaaS default OFF. */
const AI_FEATURE_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';

type SummaryConfig_ = Omit<GenerateSummaryRequest, 'exportId'>;

const DEFAULT_CONFIG: SummaryConfig_ = {
  provider: 'openai',
  language: 'English',
  detailLevel: 'standard',
};

/** Max time to poll before declaring a timeout (5 minutes). */
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function SummaryViewerPage() {
  const { id: exportId } = useParams<{ id: string }>();
  const [summaryConfig, setSummaryConfig] = useState<SummaryConfig_>(DEFAULT_CONFIG);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<SummaryJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // BAA gate — first-time acknowledgment trước khi gửi data ra AI provider
  const baa = useBaaAcknowledgment();

  // Consent gate — phải đồng ý xử lý dữ liệu xuyên biên giới trước khi gọi AI
  const { hasConsent, requestConsent, modalOpen, handleModalAccept, handleModalDecline } =
    useConsent();

  // Ref tracks when polling started so we can enforce max duration
  const pollStartRef = useRef<number | null>(null);

  // Track poll start time when polling begins
  useEffect(() => {
    if (pendingJobId && !completedJob) {
      pollStartRef.current = Date.now();
    } else {
      pollStartRef.current = null;
    }
  }, [pendingJobId, completedJob]);

  const shouldStopPolling = useCallback((job: SummaryJob): boolean => {
    if (job.status === 'complete' || job.status === 'error') return true;
    // Enforce max polling duration
    if (pollStartRef.current != null && Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
      return true;
    }
    return false;
  }, []);

  // Single usePolling call — C-14 fix (was duplicated before)
  const { data: polledJob, error: pollError } = usePolling(
    () => summaryApi.getStatus(pendingJobId!),
    {
      interval: 2000,
      enabled: !!pendingJobId && !completedJob,
      shouldStop: shouldStopPolling,
    },
  );

  // Sync polled result into state
  useEffect(() => {
    if (!polledJob) return;
    if (polledJob.status === 'complete') {
      setCompletedJob(polledJob);
      setPendingJobId(null);
    } else if (polledJob.status === 'error') {
      setGenError(polledJob.error ?? 'Summary generation failed');
      setPendingJobId(null);
    }
  }, [polledJob]);

  // Handle timeout: polling stopped but job not complete
  useEffect(() => {
    if (!pendingJobId || completedJob || pollStartRef.current == null) return;
    if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
      setGenError('Summary generation timed out after 5 minutes.');
      setPendingJobId(null);
    }
  }, [polledJob, pendingJobId, completedJob]);

  // Surface polling network errors
  useEffect(() => {
    if (pollError) {
      setGenError(pollError);
      setPendingJobId(null);
    }
  }, [pollError]);

  const handleGenerate = useCallback(async () => {
    if (!exportId) return;

    // BAA gate (block 1): first-time acknowledgment cho HIPAA disclaimer
    if (!baa.acknowledged) {
      const acked = await baa.requestAcknowledgment();
      if (!acked) {
        setGenError('Bạn cần xác nhận BAA disclaimer trước khi sử dụng AI Summary.');
        return;
      }
    }

    // Consent gate (block 2): cross-border data processing per request
    if (!hasConsent) {
      const granted = await requestConsent();
      if (!granted) {
        setGenError(
          'Bạn cần đồng ý để sử dụng tính năng AI summary (Consent required for AI summary).',
        );
        return;
      }
    }

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
  }, [exportId, summaryConfig, hasConsent, requestConsent, baa]);

  return (
    <PageContainer
      title="Summary Viewer"
      description="Generate an AI-powered clinical summary for this export"
      actions={completedJob ? <SummaryActions summaryId={completedJob.id} /> : undefined}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Config */}
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Configuration
          </h2>
          <SummaryConfig
            value={summaryConfig}
            onChange={setSummaryConfig}
            disabled={generating || !!pendingJobId}
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || !!pendingJobId || !exportId || !AI_FEATURE_ENABLED}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? 'Starting…' : pendingJobId ? 'Generating…' : 'Generate Summary'}
            </button>
            {pendingJobId && !completedJob && (
              <LoadingSpinner size="sm" label="Generating summary" />
            )}
          </div>
          {!AI_FEATURE_ENABLED && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Tính năng AI Summary chưa được bật trên deployment này. Liên hệ admin hoặc self-host
              với cờ <code>VITE_AI_ENABLED=true</code>.
            </p>
          )}
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

      {/* BAA disclaimer modal — hiện lần đầu user bật AI summary */}
      <BaaDisclaimerModal baa={baa} />

      {/* Cross-border consent modal — hiện mỗi request AI nếu chưa có consent */}
      <CrossBorderConsentModal
        open={modalOpen}
        providerName={
          summaryConfig.provider === 'anthropic'
            ? 'Claude (Anthropic)'
            : summaryConfig.provider === 'openai'
              ? 'GPT (OpenAI)'
              : summaryConfig.provider
        }
        onAccept={handleModalAccept}
        onDecline={handleModalDecline}
      />
    </PageContainer>
  );
}
