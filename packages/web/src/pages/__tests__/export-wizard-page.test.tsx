/**
 * Tests for ExportWizardPage component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExportWizardPage } from '../export-wizard-page';

// Mock API dependencies
vi.mock('../../api/connector-api', () => ({
  connectorApi: {
    testConnection: vi.fn(),
  },
}));

vi.mock('../../api/export-api', () => ({
  exportApi: {
    startExport: vi.fn(),
  },
}));

// Mock file dropzone to avoid react-dropzone complexity
vi.mock('../../components/import/file-dropzone', () => ({
  FileDropzone: ({ onFilesAccepted }: { onFilesAccepted: (f: File[]) => void }) => (
    <div data-testid="file-dropzone">
      <button type="button" onClick={() => onFilesAccepted([])}>
        Drop files here
      </button>
    </div>
  ),
}));

// Mock ExportProgress to avoid polling side effects
vi.mock('../../components/export/export-progress', () => ({
  ExportProgress: ({
    onComplete,
  }: {
    onComplete: (j: unknown) => void;
    onError: (m: string) => void;
  }) => (
    <div data-testid="export-progress">
      <button type="button" onClick={() => onComplete({})}>
        Simulate Complete
      </button>
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ExportWizardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExportWizardPage', () => {
  it('renders step 1 — Select data source', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/select data source/i)).toBeInTheDocument();
    });
  });

  it('shows FHIR Endpoint option in step 1', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/fhir endpoint/i)).toBeInTheDocument();
    });
  });

  it('shows File Upload option in step 1', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/file upload/i)).toBeInTheDocument();
    });
  });

  it('renders the step indicator navigation', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /export wizard steps/i })).toBeInTheDocument();
    });
  });

  it('renders step labels in indicator', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Connector')).toBeInTheDocument();
      expect(screen.getByText('Configure')).toBeInTheDocument();
    });
  });

  it('clicking FHIR Endpoint advances to step 2', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/fhir endpoint/i)).toBeInTheDocument();
    });
    screen
      .getByText(/fhir endpoint/i)
      .closest('button')
      ?.click();
    await waitFor(() => {
      expect(screen.getByText(/fhir connection/i)).toBeInTheDocument();
    });
  });

  it('step 2 has a Next button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/fhir endpoint/i)).toBeInTheDocument();
    });
    screen
      .getByText(/fhir endpoint/i)
      .closest('button')
      ?.click();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
    });
  });

  it('step 2 has a Back button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/fhir endpoint/i)).toBeInTheDocument();
    });
    screen
      .getByText(/fhir endpoint/i)
      .closest('button')
      ?.click();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    });
  });
});
