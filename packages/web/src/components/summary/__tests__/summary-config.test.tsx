/**
 * Tests for SummaryConfig component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryConfig } from '../summary-config';
import type { GenerateSummaryRequest } from '../../../api/summary-api';

type Config = Omit<GenerateSummaryRequest, 'exportId'>;

const DEFAULT_CONFIG: Config = {
  provider: 'openai',
  language: 'English',
  detailLevel: 'standard',
};

function renderConfig(overrides: Partial<Parameters<typeof SummaryConfig>[0]> = {}) {
  const onChange = vi.fn();
  render(<SummaryConfig value={DEFAULT_CONFIG} onChange={onChange} {...overrides} />);
  return { onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SummaryConfig', () => {
  it('renders AI Provider selector', () => {
    renderConfig();
    expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
  });

  it('renders Language selector', () => {
    renderConfig();
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
  });

  it('renders Detail Level selector', () => {
    renderConfig();
    expect(screen.getByLabelText(/detail level/i)).toBeInTheDocument();
  });

  it('provider select shows openai, anthropic, google options', () => {
    renderConfig();
    const select = screen.getByLabelText(/ai provider/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('openai');
    expect(options).toContain('anthropic');
    expect(options).toContain('google');
  });

  it('language select shows English and Spanish options', () => {
    renderConfig();
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('English');
    expect(options).toContain('Spanish');
  });

  it('calls onChange when provider changes', () => {
    const { onChange } = renderConfig();
    const select = screen.getByLabelText(/ai provider/i);
    fireEvent.change(select, { target: { value: 'anthropic' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ provider: 'anthropic' }));
  });

  it('calls onChange when language changes', () => {
    const { onChange } = renderConfig();
    const select = screen.getByLabelText(/language/i);
    fireEvent.change(select, { target: { value: 'French' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ language: 'French' }));
  });

  it('disables all selects when disabled prop is true', () => {
    renderConfig({ disabled: true });
    const selects = screen.getAllByRole('combobox');
    selects.forEach((select) => expect(select).toBeDisabled());
  });

  it('reflects current provider value', () => {
    renderConfig({ value: { ...DEFAULT_CONFIG, provider: 'google' } });
    const select = screen.getByLabelText(/ai provider/i) as HTMLSelectElement;
    expect(select.value).toBe('google');
  });
});
