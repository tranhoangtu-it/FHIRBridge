/**
 * problem-section — Stat-driven section explaining the patient data portability problem.
 */

import { useScrollAnimation } from '../../hooks/use-scroll-animation';

const STATS = [
  { value: '34M+', label: 'Patient records locked in proprietary hospital systems in VN & JP' },
  { value: '7+', label: 'Incompatible HIS formats preventing cross-hospital data sharing' },
  { value: '0%', label: 'Of records currently available in open FHIR format to patients' },
];

export function ProblemSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`py-20 lg:py-24 bg-white dark:bg-slate-950 border-y border-slate-100 dark:border-slate-900 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium mb-6">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              The Problem
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 leading-tight"
              style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
            >
              Patient records are trapped in systems patients can't access
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Across Vietnam and Japan, hospital information systems (HIS) store patient data in
              proprietary, siloed formats. When patients transfer to another hospital or move
              abroad, their records don't follow them.
            </p>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              FHIRBridge solves this by converting any structured hospital export into open,
              portable FHIR R4 bundles — the international standard that any modern healthcare
              system can read.
            </p>
          </div>

          {/* Right: stats */}
          <div className="flex flex-col gap-6">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div
                  className="text-4xl font-extrabold text-teal-600 dark:text-teal-400 leading-none shrink-0 w-24"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {s.value}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed self-center">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
