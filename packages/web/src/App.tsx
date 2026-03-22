/**
 * App — router setup with layout shell (sidebar + header + content).
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppSidebar } from './components/layout/app-sidebar';
import { AppHeader } from './components/layout/app-header';
import { ErrorBoundary } from './components/shared/error-boundary';
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
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return healthOk;
}

export default function App() {
  const healthOk = useHealthCheck();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AppSidebar healthOk={healthOk} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          <ErrorBoundary>
            <Routes>
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              <Route path={ROUTES.EXPORT} element={<ExportWizardPage />} />
              <Route path={ROUTES.IMPORT} element={<ImportPage />} />
              <Route path={ROUTES.SUMMARY} element={<SummaryViewerPage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
