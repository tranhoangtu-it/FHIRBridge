/**
 * Tests for SettingsPage component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../settings-page';

// Mock setAuthToken to avoid side effects between tests
vi.mock('../../api/api-client', () => ({
  setAuthToken: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsPage', () => {
  it('renders the Settings page title', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders API Key section', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/api key/i)).toBeInTheDocument();
  });

  it('renders API key input', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText(/sk-/i);
    expect(input).toBeInTheDocument();
  });

  it('API key input is type password by default', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText(/sk-/i);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('show/hide toggle changes input type to text', () => {
    render(<SettingsPage />);
    const toggleBtn = screen.getByRole('button', { name: /show api key/i });
    fireEvent.click(toggleBtn);
    const input = screen.getByPlaceholderText(/sk-/i);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders Default AI Provider section', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/default ai provider/i)).toBeInTheDocument();
  });

  it('renders provider dropdown with openai, anthropic, google options', () => {
    render(<SettingsPage />);
    const select = screen.getByLabelText(/^provider$/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('openai');
    expect(options).toContain('anthropic');
    expect(options).toContain('google');
  });

  it('renders Summary Language dropdown', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/summary language/i)).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toBeInTheDocument();
  });

  it('renders Save Settings button', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument();
  });

  it('typing in API key input updates its value', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText(/sk-/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-test123' } });
    expect(input.value).toBe('sk-test123');
  });

  it('calls setAuthToken when Save Settings is clicked', async () => {
    const { setAuthToken } = await import('../../api/api-client');
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText(/sk-/i);
    fireEvent.change(input, { target: { value: 'sk-abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(setAuthToken).toHaveBeenCalledWith('sk-abc');
  });

  it('shows Saved! confirmation after saving', async () => {
    vi.useFakeTimers();
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
