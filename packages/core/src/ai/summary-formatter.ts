/**
 * Summary formatter — converts PatientSummary into output formats.
 * Supports: Markdown, FHIR Composition.
 * PDF output via Puppeteer is deferred — see TODO below.
 */

import type { PatientSummary } from '@fhirbridge/types';
export { formatPdf } from './pdf-formatter.js';

/** FHIR R4 Composition resource (minimal shape for type safety) */
export interface FhirComposition {
  resourceType: 'Composition';
  id?: string;
  status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type: {
    coding: Array<{ system: string; code: string; display: string }>;
    text: string;
  };
  subject?: { reference: string };
  date: string;
  author: Array<{ display: string }>;
  title: string;
  section: Array<{
    title: string;
    text: { status: 'generated'; div: string };
  }>;
}

/**
 * Format a PatientSummary as Markdown.
 * Produces a structured document with headers per section and a synthesis narrative.
 */
export function formatMarkdown(summary: PatientSummary): string {
  const { sections, synthesis, metadata } = summary;

  const lines: string[] = [
    '# Patient Summary Report',
    '',
    `> **Generated:** ${metadata.generatedAt}  `,
    `> **Provider:** ${metadata.provider} (${metadata.model})  `,
    `> **Language:** ${metadata.language}  `,
    `> **Tokens used:** ${metadata.totalTokens}  `,
    `> **De-identified:** ${metadata.deidentified ? 'Yes' : 'No'}`,
    '',
    '---',
    '',
    '> ⚠️ **Disclaimer:** This is an AI-generated summary from de-identified data.',
    '> Always verify against source medical records before clinical use.',
    '',
    '---',
    '',
    '## Clinical Narrative',
    '',
    synthesis,
    '',
    '---',
    '',
    '## Section Details',
    '',
  ];

  for (const section of sections) {
    lines.push(`### ${section.section}`);
    lines.push('');
    if (section.resourceCount > 0) {
      lines.push(`_${section.resourceCount} resource(s) summarized_`);
      lines.push('');
    }
    lines.push(section.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('_End of AI-generated summary_');

  return lines.join('\n');
}

/**
 * Format a PatientSummary as a FHIR R4 Composition resource.
 * Each section becomes a Composition.section entry.
 *
 * @param summary - The patient summary to format
 * @param patientRef - FHIR reference to the patient (e.g. 'Patient/[PATIENT]')
 */
export function formatComposition(summary: PatientSummary, patientRef: string): FhirComposition {
  const { sections, synthesis, metadata } = summary;

  const compositionSections: FhirComposition['section'] = [
    {
      title: 'Clinical Narrative',
      text: {
        status: 'generated',
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(synthesis)}</p></div>`,
      },
    },
    ...sections.map((s) => ({
      title: s.section,
      text: {
        status: 'generated' as const,
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(s.content)}</p></div>`,
      },
    })),
  ];

  return {
    resourceType: 'Composition',
    status: 'preliminary',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '34133-9',
          display: 'Summarization of episode note',
        },
      ],
      text: 'Patient Summary',
    },
    subject: patientRef ? { reference: patientRef } : undefined,
    date: metadata.generatedAt,
    author: [
      {
        display: `AI Summary Engine (${metadata.provider}/${metadata.model})`,
      },
    ],
    title: 'AI-Generated Patient Summary',
    section: compositionSections,
  };
}

/**
 * Escape HTML special characters for safe embedding in FHIR Narrative div.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
