/**
 * pricing-section — Free vs Pro pricing cards with feature comparison.
 */

import { Link } from 'react-router-dom';
import { useScrollAnimation } from '../../hooks/use-scroll-animation';
import { ROUTES } from '../../lib/constants';

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-teal-500 shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

const FREE_FEATURES = [
  '5 exports per month',
  'JSON & NDJSON output',
  'English language only',
  'CLI + REST API access',
  'Community support',
  'Self-hosted unlimited',
];

const PRO_FEATURES = [
  '100 exports per month',
  'AI clinical summaries',
  'PDF export format',
  'English, Vietnamese, Japanese',
  'Priority email support',
  'Advanced column mapper',
  'Export audit log',
];

export function PricingSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      id="pricing"
      ref={ref as React.RefObject<HTMLElement>}
      className={`py-20 lg:py-28 bg-slate-50 dark:bg-slate-900/50 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
          >
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 flex flex-col">
            <div className="mb-6">
              <h3
                className="text-xl font-bold text-slate-900 dark:text-white mb-1"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Free
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Perfect for individual patients and clinicians
              </p>
            </div>
            <div className="mb-8">
              <span
                className="text-5xl font-extrabold text-slate-900 dark:text-white"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                $0
              </span>
              <span className="text-slate-400 text-sm ml-2">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={ROUTES.DASHBOARD}
              className="block text-center py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl border-2 border-teal-500 bg-white dark:bg-slate-900 p-8 flex flex-col shadow-lg shadow-teal-500/10">
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full bg-teal-600 text-white text-xs font-bold tracking-wide uppercase shadow">
                Most Popular
              </span>
            </div>

            <div className="mb-6 mt-2">
              <h3
                className="text-xl font-bold text-slate-900 dark:text-white mb-1"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Pro
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                For hospitals, clinics, and health IT teams
              </p>
            </div>
            <div className="mb-8">
              <span
                className="text-5xl font-extrabold text-slate-900 dark:text-white"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                $5
              </span>
              <span className="text-slate-400 text-sm ml-2">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={ROUTES.DASHBOARD}
              className="block text-center py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-teal-500/25 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              Start Pro Trial
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
          Self-hosted deployment is always free and unlimited.{' '}
          <a
            href={ROUTES.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:underline"
          >
            View on GitHub →
          </a>
        </p>
      </div>
    </section>
  );
}
