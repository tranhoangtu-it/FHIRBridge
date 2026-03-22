/**
 * Tests for exportApi — start, poll, list and download export jobs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportApi } from '../export-api';

// Mock the apiClient so we never hit the network
vi.mock('../api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    download: vi.fn(),
  },
}));

import { apiClient } from '../api-client';
const mockApiClient = vi.mocked(apiClient);

const MOCK_JOB = {
  id: 'job-abc',
  patientId: 'P001',
  status: 'pending' as const,
  progress: 0,
  resourceCount: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportApi.startExport', () => {
  it('calls POST /exports with the request payload', async () => {
    mockApiClient.post.mockResolvedValueOnce(MOCK_JOB);
    const req = { connectorType: 'fhir' as const, format: 'json' as const };
    await exportApi.startExport(req);
    expect(mockApiClient.post).toHaveBeenCalledWith('/exports', req);
  });

  it('returns the created job', async () => {
    mockApiClient.post.mockResolvedValueOnce(MOCK_JOB);
    const job = await exportApi.startExport({ connectorType: 'fhir', format: 'json' });
    expect(job).toEqual(MOCK_JOB);
  });
});

describe('exportApi.getStatus', () => {
  it('calls GET /exports/:id', async () => {
    mockApiClient.get.mockResolvedValueOnce(MOCK_JOB);
    await exportApi.getStatus('job-abc');
    expect(mockApiClient.get).toHaveBeenCalledWith('/exports/job-abc');
  });

  it('returns the job', async () => {
    const running = { ...MOCK_JOB, status: 'running' as const, progress: 50 };
    mockApiClient.get.mockResolvedValueOnce(running);
    const job = await exportApi.getStatus('job-abc');
    expect(job.progress).toBe(50);
    expect(job.status).toBe('running');
  });
});

describe('exportApi.listExports', () => {
  it('calls GET /exports', async () => {
    mockApiClient.get.mockResolvedValueOnce([]);
    await exportApi.listExports();
    expect(mockApiClient.get).toHaveBeenCalledWith('/exports');
  });

  it('returns array of jobs', async () => {
    mockApiClient.get.mockResolvedValueOnce([MOCK_JOB]);
    const jobs = await exportApi.listExports();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('job-abc');
  });
});

describe('exportApi.downloadBundle', () => {
  it('calls download with /exports/:id/bundle path', async () => {
    const blob = new Blob(['{}']);
    mockApiClient.download.mockResolvedValueOnce(blob);
    await exportApi.downloadBundle('job-abc');
    expect(mockApiClient.download).toHaveBeenCalledWith('/exports/job-abc/bundle');
  });

  it('returns the blob data', async () => {
    const blob = new Blob(['{"resourceType":"Bundle"}'], { type: 'application/json' });
    mockApiClient.download.mockResolvedValueOnce(blob);
    const result = await exportApi.downloadBundle('job-abc');
    expect(result).toBe(blob);
  });
});
