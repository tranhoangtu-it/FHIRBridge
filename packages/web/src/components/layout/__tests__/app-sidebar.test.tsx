/**
 * Tests for AppSidebar component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppSidebar } from '../app-sidebar';

function renderSidebar(props: Parameters<typeof AppSidebar>[0] = {}) {
  return render(
    <MemoryRouter>
      <AppSidebar {...props} />
    </MemoryRouter>,
  );
}

describe('AppSidebar', () => {
  it('renders the FHIRBridge brand name', () => {
    renderSidebar();
    expect(screen.getByText('FHIRBridge')).toBeInTheDocument();
  });

  it('renders Dashboard nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders Export nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /export/i })).toBeInTheDocument();
  });

  it('renders Import nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /import/i })).toBeInTheDocument();
  });

  it('renders Settings nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('Dashboard link points to "/"', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/app/dashboard');
  });

  it('Export link points to "/export"', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /export/i });
    expect(link).toHaveAttribute('href', '/app/export');
  });

  it('Import link points to "/import"', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /import/i });
    expect(link).toHaveAttribute('href', '/app/import');
  });

  it('Settings link points to "/settings"', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link).toHaveAttribute('href', '/app/settings');
  });

  it('shows "Checking…" when healthOk is undefined', () => {
    renderSidebar();
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });

  it('shows "API online" when healthOk is true', () => {
    renderSidebar({ healthOk: true });
    expect(screen.getByText('API online')).toBeInTheDocument();
  });

  it('shows "API offline" when healthOk is false', () => {
    renderSidebar({ healthOk: false });
    expect(screen.getByText('API offline')).toBeInTheDocument();
  });
});
