/**
 * SettingsPage — API key, default provider, language, and theme toggle.
 * API key stored in memory only (never persisted to browser storage).
 */

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { PageContainer } from '../components/layout/page-container';
import { setAuthToken } from '../api/api-client';

const PROVIDERS = ['openai', 'anthropic', 'google'] as const;
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese'] as const;

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  };
  return { dark, toggle };
}

export function SettingsPage() {
  const { dark, toggle } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<typeof PROVIDERS[number]>('openai');
  const [language, setLanguage] = useState<typeof LANGUAGES[number]>('English');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setAuthToken(apiKey || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    // Intentionally no-op: we do not read tokens from storage (security)
  }, []);

  return (
    <PageContainer title="Settings" description="Configure API credentials and application preferences">
      <div className="mx-auto max-w-xl space-y-6">
        {/* API Key */}
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">API Key</h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Stored in memory only — cleared when you close this tab. Never saved to disk.
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </section>

        {/* Default AI Provider */}
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Default AI Provider</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="default-provider" className="block text-xs text-gray-500 mb-1">Provider</label>
              <select
                id="default-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {PROVIDERS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="default-language" className="block text-xs text-gray-500 mb-1">Summary Language</label>
              <select
                id="default-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Appearance</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {dark ? 'Dark mode' : 'Light mode'}
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Save Settings
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </PageContainer>
  );
}
