/**
 * Tests for ConnectorForm component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectorForm, type ConnectorConfig } from '../connector-form';

const DEFAULT_VALUE: ConnectorConfig = { url: '', clientId: '', clientSecret: '' };

function renderForm(overrides: Partial<Parameters<typeof ConnectorForm>[0]> = {}) {
  const onChange = vi.fn();
  render(<ConnectorForm value={DEFAULT_VALUE} onChange={onChange} {...overrides} />);
  return { onChange };
}

describe('ConnectorForm', () => {
  it('renders FHIR Server URL input', () => {
    renderForm();
    expect(screen.getByLabelText(/fhir server url/i)).toBeInTheDocument();
  });

  it('renders Client ID input', () => {
    renderForm();
    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
  });

  it('renders Client Secret input', () => {
    renderForm();
    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
  });

  it('URL input has type="url"', () => {
    renderForm();
    const input = screen.getByLabelText(/fhir server url/i);
    expect(input).toHaveAttribute('type', 'url');
  });

  it('Client Secret input has type="password"', () => {
    renderForm();
    const input = screen.getByLabelText(/client secret/i);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('calls onChange when URL input changes', () => {
    const { onChange } = renderForm();
    const input = screen.getByLabelText(/fhir server url/i);
    fireEvent.change(input, { target: { value: 'https://fhir.example.com' } });
    expect(onChange).toHaveBeenCalledWith({
      url: 'https://fhir.example.com',
      clientId: '',
      clientSecret: '',
    });
  });

  it('calls onChange when Client ID changes', () => {
    const { onChange } = renderForm();
    const input = screen.getByLabelText(/client id/i);
    fireEvent.change(input, { target: { value: 'client-123' } });
    expect(onChange).toHaveBeenCalledWith({
      url: '',
      clientId: 'client-123',
      clientSecret: '',
    });
  });

  it('does not render Test Connection button when onTest is not provided', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: /test connection/i })).not.toBeInTheDocument();
  });

  it('renders Test Connection button when onTest is provided', () => {
    renderForm({ onTest: vi.fn() });
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
  });

  it('Test Connection button is disabled when URL is empty', () => {
    renderForm({ onTest: vi.fn() });
    const btn = screen.getByRole('button', { name: /test connection/i });
    expect(btn).toBeDisabled();
  });

  it('Test Connection button is enabled when URL is provided', () => {
    renderForm({
      value: { url: 'https://fhir.example.com', clientId: '', clientSecret: '' },
      onTest: vi.fn(),
    });
    const btn = screen.getByRole('button', { name: /test connection/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows test result message when testResult is provided', () => {
    renderForm({
      onTest: vi.fn(),
      testResult: { success: true, message: 'Connection successful' },
    });
    expect(screen.getByText('Connection successful')).toBeInTheDocument();
  });

  it('shows "Testing…" label when testing prop is true', () => {
    renderForm({
      value: { url: 'https://fhir.example.com', clientId: '', clientSecret: '' },
      onTest: vi.fn(),
      testing: true,
    });
    expect(screen.getByRole('button', { name: /testing/i })).toBeInTheDocument();
  });
});
