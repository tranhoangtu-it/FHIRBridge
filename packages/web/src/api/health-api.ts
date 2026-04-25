/**
 * Health API — check API server liveness.
 */

import { apiClient } from './api-client';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version?: string;
  timestamp: string;
}

export const healthApi = {
  /** GET /api/v1/health */
  async checkHealth(): Promise<HealthStatus> {
    return apiClient.get<HealthStatus>('/v1/health');
  },
};
