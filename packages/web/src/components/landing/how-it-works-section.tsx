/**
 * how-it-works-section — 3-step visual flow showing the FHIRBridge workflow.
 */

import { useScrollAnimation } from '../../hooks/use-scroll-animation';

const STEPS = [
  {
    num: '01',
    title: 'Connect',
    desc: 'Upload a CSV or Excel export from any HIS system, or connect via our REST API. No proprietary connectors required.',
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Export',
    desc: 'FHIRBridge maps your data to FHIR R4 resources in real time — Patient, Condition, Medication, Observation, and more.',
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Summarize',
    desc: 'Optionally generate an AI-powered clinical summary in English, Vietnamese, or Japanese — de-identified and stream-only.',
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
        />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`py-20 lg:py-28 bg-white dark:bg-slate-950 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
          >
            From raw hospital data to FHIR in minutes
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Three simple steps. Zero configuration required to get started.
          </p>
        </div>

        {/* Steps row */}
        <div className="relative flex flex-col md:flex-row gap-8 md:gap-0">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.666%+2rem)] right-[calc(16.666%+2rem)] h-px bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 dark:from-teal-700 dark:via-teal-600 dark:to-teal-700" />

          {STEPS.map((step, i) => (
            <div key={i} className="relative flex-1 flex flex-col items-center text-center px-6">
              {/* Number circle */}
              <div className="relative z-10 w-20 h-20 rounded-2xl bg-teal-600 text-white flex flex-col items-center justify-center shadow-lg shadow-teal-500/30 mb-6">
                <div className="text-white/60 text-xs font-mono mb-0.5">{step.num}</div>
                {step.icon}
              </div>
              <h3
                className="text-xl font-bold text-slate-900 dark:text-white mb-3"
                style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
              >
                {step.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                {step.desc}
              </p>

              {/* Mobile connector arrow */}
              {i < STEPS.length - 1 && (
                <div className="md:hidden mt-6 text-teal-400">
                  <svg
                    className="w-5 h-5 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
