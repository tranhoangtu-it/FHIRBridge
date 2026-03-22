/**
 * SummaryActions — download PDF and Markdown buttons for a completed summary.
 */

import { Download, FileText } from 'lucide-react';
import { summaryApi } from '../../api/summary-api';

interface Props {
  summaryId: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SummaryActions({ summaryId }: Props) {
  const downloadMarkdown = async () => {
    try {
      const blob = await summaryApi.downloadMarkdown(summaryId);
      triggerDownload(blob, `summary-${summaryId}.md`);
    } catch {
      alert('Markdown download failed.');
    }
  };

  const downloadPdf = async () => {
    try {
      const blob = await summaryApi.downloadPdf(summaryId);
      triggerDownload(blob, `summary-${summaryId}.pdf`);
    } catch {
      alert('PDF download failed.');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void downloadMarkdown()}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <FileText className="h-4 w-4" aria-hidden />
        Download Markdown
      </button>
      <button
        type="button"
        onClick={() => void downloadPdf()}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Download className="h-4 w-4" aria-hidden />
        Download PDF
      </button>
    </div>
  );
}
