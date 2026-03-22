/**
 * Export API module — start, poll, and download FHIR export jobs.
 */

import { apiClient } from './api-client';

export type ExportStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ExportJob {
  id: string;
  patientId: string;
  status: ExportStatus;
  progress: number; // 0-100
  resourceCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface StartExportRequest {
  connectorType: 'fhir' | 'file';
  connectorConfig?: {
    url?: string;
    clientId?: string;
    clientSecret?: string;
  };
  patientId?: string;
  fileUploadId?: string;
  format?: 'json' | 'ndjson';
  includeSummary?: boolean;
  summaryProvider?: string;
  summaryLanguage?: string;
}

export const exportApi = {
  async startExport(req: StartExportRequest): Promise<ExportJob> {
    return apiClient.post<ExportJob>('/exports', req);
  },

  async getStatus(jobId: string): Promise<ExportJob> {
    return apiClient.get<ExportJob>(`/exports/${jobId}`);
  },

  async listExports(): Promise<ExportJob[]> {
    return apiClient.get<ExportJob[]>('/exports');
  },

  async downloadBundle(jobId: string): Promise<Blob> {
    return apiClient.download(`/exports/${jobId}/bundle`);
  },
};
