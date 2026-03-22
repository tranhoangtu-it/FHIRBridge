/**
 * Tests for SummaryDisplay component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryDisplay } from '../summary-display';

describe('SummaryDisplay', () => {
  it('renders the AI disclaimer banner', () => {
    render(<SummaryDisplay content="Hello" />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('shows AI-generated summary text in disclaimer', () => {
    render(<SummaryDisplay content="Hello" />);
    expect(screen.getByText(/ai-generated summary/i)).toBeInTheDocument();
  });

  it('shows healthcare provider warning in disclaimer', () => {
    render(<SummaryDisplay content="Hello" />);
    expect(screen.getByText(/qualified healthcare provider/i)).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(<SummaryDisplay content="## Patient Summary\n\nPatient is healthy." />);
    expect(screen.getByText(/patient is healthy/i)).toBeInTheDocument();
  });

  it('renders heading from markdown', () => {
    render(<SummaryDisplay content="## Patient Summary" />);
    expect(screen.getByRole('heading', { name: /patient summary/i })).toBeInTheDocument();
  });

  it('renders plain text content', () => {
    render(<SummaryDisplay content="No findings." />);
    expect(screen.getByText('No findings.')).toBeInTheDocument();
  });
});
