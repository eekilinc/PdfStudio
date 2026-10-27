import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { checkPdfA, writeDocumentId, writePdfAMetadata } from '../utils/pdfa';
import { exportModifiedPdf } from '../utils/pdfExport';
import type { PDFDocumentState } from '../types/pdf';

/** A simple document with a title but without any archival metadata. */
async function buildDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.setTitle('Arşiv Belgesi');
  return await doc.save();
}

/** The editing state of a document that was just opened. */
function stateFor(bytes: Uint8Array): PDFDocumentState {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    filename: 'kaynak.pdf',
    fileSize: bytes.byteLength,
    data: data as ArrayBuffer,
    numPages: 1,
    pages: [
      {
        pageIndex: 0,
        originalPageNumber: 1,
        displayPageNumber: 1,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
    ],
    pageOrder: [0],
    annotations: {},
  };
}

/** The XMP metadata of a document, as text. */
function xmpOf(doc: PDFDocument): string {
  const metadata = doc.catalog.get(PDFName.of('Metadata'));
  const stream = metadata instanceof PDFRef ? doc.context.lookup(metadata) : metadata;
  if (!(stream instanceof PDFRawStream)) return '';
  return new TextDecoder('utf-8').decode(stream.contents);
}

describe('PDF/A', () => {
  it('reports what the document still needs', async () => {
    const source = await buildDocument();
    const report = await checkPdfA(source);

    const rules = report.findings.map((f) => f.rule);
    expect(rules).toContain('xmp-metadata');
    expect(rules).toContain('output-intent');
    expect(rules).toContain('document-id');

    // The document does not claim to be a PDF/A file yet.
    expect(report.declared).toBeUndefined();
    expect(report.hasMetadata).toBe(false);
  });

  it('writes the metadata that declares the document as PDF/A', async () => {
    const source = await buildDocument();
    const doc = await PDFDocument.load(source, { updateMetadata: false });

    writePdfAMetadata(doc, { part: '2', conformance: 'B' }, { title: 'Arşiv Belgesi' });
    writeDocumentId(doc);

    const bytes = await doc.save();
    const report = await checkPdfA(bytes);

    expect(report.declared).toEqual({ part: '2', conformance: 'B' });
    expect(report.hasMetadata).toBe(true);
    // The identifier is written, so it is no longer reported.
    expect(report.findings.map((f) => f.rule)).not.toContain('document-id');
  });

  it('writes the archival metadata into the saved document', async () => {
    const source = await buildDocument();
    const state = stateFor(source);
    state.pdfa = { part: '2', conformance: 'B' };

    const bytes = await exportModifiedPdf(state);
    const report = await checkPdfA(bytes);

    expect(report.declared).toEqual({ part: '2', conformance: 'B' });

    // The metadata really is in the file.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(xmpOf(doc)).toContain('pdfaid:part>2<');
    expect(xmpOf(doc)).toContain('pdfaid:conformance>B<');
  });
});
