/**
 * PDF formatter — converts PatientSummary into a professional A4 PDF report.
 * Uses pdfkit (built-in Helvetica fonts, no Puppeteer dependency).
 * Returns a Buffer containing the PDF bytes.
 */

import type { PatientSummary } from '@fhirbridge/types';
import PDFDocument from 'pdfkit';

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Colour palette */
const COLOR_PRIMARY = '#1a3a5c';
const COLOR_ACCENT = '#2563eb';
const COLOR_MUTED = '#6b7280';
const COLOR_BORDER = '#e5e7eb';

/**
 * Generate a PDF report for the given PatientSummary.
 * @returns Promise resolving to a Buffer containing the PDF bytes.
 */
export function formatPdf(summary: PatientSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderHeader(doc, summary);
    renderMetadata(doc, summary);
    renderDisclaimer(doc);
    renderNarrative(doc, summary);
    renderSections(doc, summary);
    renderFooter(doc);

    doc.end();
  });
}

/** Render the top header bar with FHIRBridge branding */
function renderHeader(doc: PDFKit.PDFDocument, _summary: PatientSummary): void {
  doc.rect(MARGIN - 10, MARGIN - 10, CONTENT_WIDTH + 20, 50).fill(COLOR_PRIMARY);

  doc
    .fillColor('#ffffff')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('FHIRBridge', MARGIN, MARGIN + 8, { continued: true })
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#93c5fd')
    .text('  — AI Patient Summary', { align: 'left' });

  doc.moveDown(2);
  doc
    .fillColor(COLOR_PRIMARY)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Patient Summary Report', MARGIN, doc.y);

  doc
    .moveTo(MARGIN, doc.y + 4)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 4)
    .strokeColor(COLOR_ACCENT)
    .lineWidth(2)
    .stroke();

  doc.moveDown(1);
}

/** Render metadata block (generated at, provider, model, etc.) */
function renderMetadata(doc: PDFKit.PDFDocument, summary: PatientSummary): void {
  const { metadata } = summary;
  const metaItems = [
    ['Generated', metadata.generatedAt],
    ['Provider', `${metadata.provider} (${metadata.model})`],
    ['Language', metadata.language],
    ['Tokens used', String(metadata.totalTokens)],
    ['De-identified', metadata.deidentified ? 'Yes' : 'No'],
  ];

  doc.fontSize(9).font('Helvetica').fillColor(COLOR_MUTED);

  for (const [label, value] of metaItems) {
    doc
      .text(`${label}: `, { continued: true })
      .font('Helvetica-Bold')
      .text(value ?? '')
      .font('Helvetica');
  }

  doc.moveDown(0.5);
}

/** Render the AI disclaimer box */
function renderDisclaimer(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  const boxHeight = 30;
  doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight).fillAndStroke('#fff7ed', '#f97316');

  doc
    .fillColor('#c2410c')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text(
      'WARNING: This is an AI-generated summary from de-identified data. Always verify against source medical records before clinical use.',
      MARGIN + 8,
      y + 8,
      { width: CONTENT_WIDTH - 16 },
    );

  doc.moveDown(2);
}

/** Render the clinical narrative section */
function renderNarrative(doc: PDFKit.PDFDocument, summary: PatientSummary): void {
  renderSectionHeading(doc, 'Clinical Narrative');
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#111827')
    .text(summary.synthesis, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'justify' });
  doc.moveDown(1);
}

/** Render all summary sections */
function renderSections(doc: PDFKit.PDFDocument, summary: PatientSummary): void {
  renderSectionHeading(doc, 'Section Details');

  for (const section of summary.sections) {
    // Add new page if near bottom
    if (doc.y > 700) doc.addPage();

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(COLOR_ACCENT)
      .text(section.section, MARGIN, doc.y);

    if (section.resourceCount > 0) {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(COLOR_MUTED)
        .text(`${section.resourceCount} resource(s) summarized`);
    }

    doc
      .moveTo(MARGIN, doc.y + 2)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .moveDown(0.3)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text(section.content, MARGIN, doc.y, { width: CONTENT_WIDTH });

    doc.moveDown(1);
  }
}

/** Render a section heading with a coloured background strip */
function renderSectionHeading(doc: PDFKit.PDFDocument, title: string): void {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fill('#eff6ff');
  doc
    .fillColor(COLOR_PRIMARY)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(title, MARGIN + 6, y + 3);
  doc.moveDown(0.8);
}

/** Stamp footer on every page */
function renderFooter(doc: PDFKit.PDFDocument): void {
  const pageCount = (
    doc as unknown as { bufferedPageRange(): { count: number } }
  ).bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - MARGIN + 10;
    doc
      .moveTo(MARGIN, footerY - 6)
      .lineTo(PAGE_WIDTH - MARGIN, footerY - 6)
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(COLOR_MUTED)
      .text('AI-generated summary — verify with healthcare provider', MARGIN, footerY, {
        width: CONTENT_WIDTH * 0.7,
        align: 'left',
      });

    doc.text(`Page ${i + 1} of ${pageCount}`, MARGIN, footerY, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
  }
}
