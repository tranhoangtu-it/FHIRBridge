/**
 * Connector API — test FHIR endpoint connections and upload source files.
 */

import { apiClient } from './api-client';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  sizeBytes: number;
  columns?: string[];
  rowCount?: number;
  uploadedAt: string;
}

export const connectorApi = {
  async testConnection(url: string, clientId?: string, clientSecret?: string): Promise<ConnectionTestResult> {
    return apiClient.post<ConnectionTestResult>('/connectors/test', {
      url,
      clientId,
      clientSecret,
    });
  },

  async uploadFile(file: File): Promise<UploadedFile> {
    return apiClient.upload<UploadedFile>('/connectors/upload', file);
  },
};
