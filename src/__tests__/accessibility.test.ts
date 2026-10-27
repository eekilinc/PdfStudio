import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRef } from 'pdf-lib';
import {
  checkAccessibility,
  figureKey,
  readFigureAltTexts,
  setDisplayDocTitle,
  setDocumentLanguage,
  setFieldDescriptions,
  tagDocument,
} from '../utils/a11y';
import { exportModifiedPdf } from '../utils/pdfExport';
import type { PDFDocumentState } from '../types/pdf';

/** A document with a text, an image and a form field. */
async function buildDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);

  const png = await doc.embedPng(
    Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    ),
  );
  page.drawImage(png, { x: 40, y: 600, width: 60, height: 60 });

  const form = doc.getForm();
  const field = form.createTextField('kullanici adi');
  field.addToPage(page, { x: 40, y: 500, width: 200, height: 24 });

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

describe('accessibility checker', () => {
  it('reports the problems of an untagged document', async () => {
    const source = await buildDocument();
    const report = await checkAccessibility(source);

    expect(report.tagged).toBe(false);
    expect(report.pageCount).toBe(1);

    const rules = report.findings.map((f) => f.rule);
    expect(rules).toContain('tagged-pdf');
    expect(rules).toContain('primary-language');
    expect(rules).toContain('title');
    expect(rules).toContain('figures-alt-text');
    expect(rules).toContain('field-descriptions');

    // The image of the page is reported as a figure.
    expect(report.figures).toHaveLength(1);
    expect(report.figures[0]!.pageIndex).toBe(0);
    expect(report.figures[0]!.alt).toBeUndefined();
  });

  it('reports no problem with a document that was fixed', async () => {
    const source = await buildDocument();
    const report0 = await checkAccessibility(source);
    const imageName = report0.figures[0]!.name;

    const doc = await PDFDocument.load(source, { updateMetadata: false });

    tagDocument(doc, { [figureKey(0, imageName)]: 'Bir kare şekli' });
    setDocumentLanguage(doc, 'tr');
    setDisplayDocTitle(doc, true);
    setFieldDescriptions(doc);
    doc.setTitle('Erişilebilir Belge');

    const fixed = await doc.save();
    const report = await checkAccessibility(fixed);

    expect(report.tagged).toBe(true);
    expect(report.language).toBe('tr');
    expect(report.title).toBe('Erişilebilir Belge');
    expect(report.fieldsWithoutDescription).toBe(0);

    const rules = report.findings.map((f) => f.rule);
    expect(rules).not.toContain('tagged-pdf');
    expect(rules).not.toContain('primary-language');
    expect(rules).not.toContain('figures-alt-text');
    expect(rules).not.toContain('field-descriptions');
  });
});

describe('tagging', () => {
  it('writes a structure tree with a paragraph per page', async () => {
    const source = await buildDocument();
    const doc = await PDFDocument.load(source, { updateMetadata: false });

    tagDocument(doc, {});
    const bytes = await doc.save();

    const out = await PDFDocument.load(bytes, { updateMetadata: false });
    const root = out.catalog.get(PDFName.of('StructTreeRoot'));
    expect(root).toBeDefined();

    const rootDict = root instanceof PDFRef ? out.context.lookup(root) : root;
    expect(rootDict).toBeInstanceOf(PDFDict);

    const markInfo = out.catalog.get(PDFName.of('MarkInfo'));
    expect(markInfo).toBeDefined();

    // The page points at its place in the parent tree.
    const page = out.getPages()[0]!;
    expect(page.node.get(PDFName.of('StructParents'))).toBeInstanceOf(PDFNumber);
  });

  it('writes the description of a figure', async () => {
    const source = await buildDocument();
    const report = await checkAccessibility(source);
    const imageName = report.figures[0]!.name;

    const doc = await PDFDocument.load(source, { updateMetadata: false });

    tagDocument(doc, { [figureKey(0, imageName)]: 'Şirket logosu' });
    const bytes = await doc.save();

    const out = await PDFDocument.load(bytes, { updateMetadata: false });
    const altTexts = readFigureAltTexts(out);

    expect(Array.from(altTexts.values())).toContain('Şirket logosu');
  });

  it('writes the tagging into the saved document', async () => {
    const source = await buildDocument();
    const report = await checkAccessibility(source);
    const imageName = report.figures[0]!.name;

    const state = stateFor(source);
    state.accessibility = {
      tagged: true,
      altTexts: { [figureKey(0, imageName)]: 'Şirket logosu' },
      language: 'tr',
      title: 'Erişilebilir Belge',
      displayDocTitle: true,
      fieldDescriptions: true,
    };

    const bytes = await exportModifiedPdf(state);
    const result = await checkAccessibility(bytes);

    expect(result.tagged).toBe(true);
    expect(result.language).toBe('tr');
    expect(result.title).toBe('Erişilebilir Belge');
    expect(result.fieldsWithoutDescription).toBe(0);

    const altTexts = Array.from(readFigureAltTexts(await PDFDocument.load(bytes)).values());
    expect(altTexts).toContain('Şirket logosu');
  });
});
