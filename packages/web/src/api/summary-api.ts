/**
 * Summary API — generate and download AI-generated patient summaries.
 */

import { apiClient } from './api-client';

export type SummaryStatus = 'pending' | 'generating' | 'complete' | 'error';

export interface SummaryJob {
  id: string;
  exportId: string;
  status: SummaryStatus;
  provider: string;
  language: string;
  detailLevel: 'brief' | 'standard' | 'detailed';
  content?: string;
  createdAt: string;
  error?: string;
}

export interface GenerateSummaryRequest {
  exportId: string;
  provider: string;
  model?: string;
  language: string;
  detailLevel: 'brief' | 'standard' | 'detailed';
}

export const summaryApi = {
  async generateSummary(req: GenerateSummaryRequest): Promise<SummaryJob> {
    return apiClient.post<SummaryJob>('/summaries', req);
  },

  async getStatus(summaryId: string): Promise<SummaryJob> {
    return apiClient.get<SummaryJob>(`/summaries/${summaryId}`);
  },

  async downloadMarkdown(summaryId: string): Promise<Blob> {
    return apiClient.download(`/summaries/${summaryId}/markdown`);
  },

  async downloadPdf(summaryId: string): Promise<Blob> {
    return apiClient.download(`/summaries/${summaryId}/pdf`);
  },
};
