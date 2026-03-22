/**
 * Tests for SummaryActions component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryActions } from '../summary-actions';

vi.mock('../../../api/summary-api', () => ({
  summaryApi: {
    downloadMarkdown: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
  global.URL.revokeObjectURL = vi.fn();
});

describe('SummaryActions', () => {
  it('renders Download Markdown button', () => {
    render(<SummaryActions summaryId="sum-1" />);
    expect(screen.getByRole('button', { name: /download markdown/i })).toBeInTheDocument();
  });

  it('renders Download PDF button', () => {
    render(<SummaryActions summaryId="sum-1" />);
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });

  it('clicking Download Markdown calls summaryApi.downloadMarkdown', async () => {
    const { summaryApi } = await import('../../../api/summary-api');
    vi.mocked(summaryApi.downloadMarkdown).mockResolvedValueOnce(new Blob(['# md']));

    render(<SummaryActions summaryId="sum-1" />);
    screen.getByRole('button', { name: /download markdown/i }).click();

    await vi.waitFor(() => {
      expect(summaryApi.downloadMarkdown).toHaveBeenCalledWith('sum-1');
    });
  });

  it('clicking Download PDF calls summaryApi.downloadPdf', async () => {
    const { summaryApi } = await import('../../../api/summary-api');
    vi.mocked(summaryApi.downloadPdf).mockResolvedValueOnce(new Blob(['%PDF']));

    render(<SummaryActions summaryId="sum-1" />);
    screen.getByRole('button', { name: /download pdf/i }).click();

    await vi.waitFor(() => {
      expect(summaryApi.downloadPdf).toHaveBeenCalledWith('sum-1');
    });
  });
});
