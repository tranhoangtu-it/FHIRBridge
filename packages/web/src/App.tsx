/**
 * App — router setup.
 * '/'       → public LandingPage (no sidebar)
 * '/app/*'  → authenticated app shell with sidebar + header
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppSidebar } from './components/layout/app-sidebar';
import { AppHeader } from './components/layout/app-header';
import { ErrorBoundary } from './components/shared/error-boundary';
import { LandingPage } from './pages/landing-page';
import { DashboardPage } from './pages/dashboard-page';
import { ExportWizardPage } from './pages/export-wizard-page';
import { ImportPage } from './pages/import-page';
import { SummaryViewerPage } from './pages/summary-viewer-page';
import { SettingsPage } from './pages/settings-page';
import { healthApi } from './api/health-api';
import { ROUTES } from './lib/constants';

function useHealthCheck() {
  const [healthOk, setHealthOk] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const h = await healthApi.checkHealth();
        if (!cancelled) setHealthOk(h.status === 'ok');
      } catch {
        if (!cancelled) setHealthOk(false);
      }
    };
    void check();
    const interval = setInterval(() => void check(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return healthOk;
}

function AppShell() {
  const healthOk = useHealthCheck();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AppSidebar healthOk={healthOk} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          <ErrorBoundary>
            <Routes>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="export" element={<ExportWizardPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="summary/:id" element={<SummaryViewerPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.LANDING} element={<LandingPage />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
    </Routes>
  );
}
