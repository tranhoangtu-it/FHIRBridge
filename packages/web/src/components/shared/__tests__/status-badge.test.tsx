/**
 * Tests for StatusBadge component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="complete" />);
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('applies green classes for complete status', () => {
    render(<StatusBadge status="complete" />);
    const badge = screen.getByText('complete');
    expect(badge.className).toContain('green');
  });

  it('applies blue classes for running status', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByText('running');
    expect(badge.className).toContain('blue');
  });

  it('applies blue classes for generating status', () => {
    render(<StatusBadge status="generating" />);
    const badge = screen.getByText('generating');
    expect(badge.className).toContain('blue');
  });

  it('applies yellow classes for pending status', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge.className).toContain('yellow');
  });

  it('applies red classes for error status', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByText('error');
    expect(badge.className).toContain('red');
  });

  it('applies gray fallback classes for unknown status', () => {
    render(<StatusBadge status="unknown-xyz" />);
    const badge = screen.getByText('unknown-xyz');
    expect(badge.className).toContain('gray');
  });

  it('merges custom className prop', () => {
    render(<StatusBadge status="complete" className="my-custom-class" />);
    const badge = screen.getByText('complete');
    expect(badge.className).toContain('my-custom-class');
  });

  it('renders as an inline span element', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge.tagName).toBe('SPAN');
  });

  it('has capitalize class for text formatting', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge.className).toContain('capitalize');
  });
});
