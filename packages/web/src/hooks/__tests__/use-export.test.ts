/**
 * Tests for useExport hook — export wizard state machine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExport } from '../use-export';

vi.mock('../../api/export-api', () => ({
  exportApi: {
    startExport: vi.fn(),
  },
}));

import { exportApi } from '../../api/export-api';
const mockExportApi = vi.mocked(exportApi);

const MOCK_JOB = {
  id: 'job-1',
  patientId: 'P001',
  status: 'pending' as const,
  progress: 0,
  resourceCount: 0,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useExport — initial state', () => {
  it('starts in idle phase', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.flowState.phase).toBe('idle');
  });

  it('has default config with fhir connector type', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.config.connectorType).toBe('fhir');
  });

  it('has default format of json', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.config.format).toBe('json');
  });

  it('has includeSummary false by default', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.config.includeSummary).toBe(false);
  });
});

describe('useExport — goToStep', () => {
  it('transitions to configuring phase with correct step', () => {
    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.goToStep(1);
    });
    expect(result.current.flowState.phase).toBe('configuring');
    if (result.current.flowState.phase === 'configuring') {
      expect(result.current.flowState.step).toBe(1);
    }
  });

  it('can advance through steps', () => {
    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.goToStep(3);
    });
    if (result.current.flowState.phase === 'configuring') {
      expect(result.current.flowState.step).toBe(3);
    }
  });
});

describe('useExport — updateConfig', () => {
  it('merges partial config updates', () => {
    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.updateConfig({ patientId: 'P999' });
    });
    expect(result.current.config.patientId).toBe('P999');
  });

  it('preserves existing config fields when updating partially', () => {
    const { result } = renderHook(() => useExport());
    act(() => {
      result.current.updateConfig({ patientId: 'P999' });
    });
    expect(result.current.config.connectorType).toBe('fhir');
    expect(result.current.config.format).toBe('json');
  });
});

describe('useExport — startExport', () => {
  it('transitions to exporting phase on success', async () => {
    mockExportApi.startExport.mockResolvedValueOnce({ ...MOCK_JOB, id: 'job-42' });
    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport();
    });

    expect(result.current.flowState.phase).toBe('exporting');
    if (result.current.flowState.phase === 'exporting') {
      expect(result.current.flowState.jobId).toBe('job-42');
    }
  });

  it('transitions to error phase on failure', async () => {
    mockExportApi.startExport.mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport();
    });

    expect(result.current.flowState.phase).toBe('error');
    if (result.current.flowState.phase === 'error') {
      expect(result.current.flowState.message).toBe('Server error');
    }
  });
});

describe('useExport — reset', () => {
  it('resets flow state to idle', async () => {
    mockExportApi.startExport.mockResolvedValueOnce(MOCK_JOB);
    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.flowState.phase).toBe('idle');
  });

  it('resets config to defaults', async () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.updateConfig({ patientId: 'P999', format: 'ndjson' });
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.config.patientId).toBeUndefined();
    expect(result.current.config.format).toBe('json');
  });
});
