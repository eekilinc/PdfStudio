import { describe, it, expect } from 'vitest';
import { collectRedactions, hasRedactions, redactedPageIndices, REDACTION_QUALITY } from '../utils/redaction';
import type { PDFDocumentState, Annotation, RedactionAnnotation } from '../types/pdf';

const page = (pageIndex: number, extra: Partial<PDFDocumentState['pages'][number]> = {}) => ({
  pageIndex,
  originalPageNumber: pageIndex + 1,
  displayPageNumber: pageIndex + 1,
  rotation: 0,
  width: 595.28,
  height: 841.89,
  aspectRatio: 595.28 / 841.89,
  ...extra,
});

const redact = (pageIndex: number, id: string, x = 10, y = 20): Annotation =>
  ({
    id,
    pageIndex,
    type: 'redact',
    x,
    y,
    width: 100,
    height: 20,
    color: '#000000',
    opacity: 1,
  }) as RedactionAnnotation;

const doc = (
  pages: PDFDocumentState['pages'],
  pageOrder: number[],
  annotations: Record<number, Annotation[]>,
): PDFDocumentState => ({
  filename: 'd.pdf',
  fileSize: 1,
  data: null,
  numPages: pages.length,
  pages,
  pageOrder,
  annotations,
});

describe('hasRedactions', () => {
  it('is false for a document with no annotations', () => {
    expect(hasRedactions(doc([page(0)], [0], {}))).toBe(false);
  });

  it('is false when only non-redaction annotations are present', () => {
    const text: Annotation = { ...redact(0, 't'), type: 'text', text: 'hello' } as Annotation;
    expect(hasRedactions(doc([page(0)], [0], { 0: [text] }))).toBe(false);
  });

  it('is true when any page carries a redaction', () => {
    expect(hasRedactions(doc([page(0), page(1)], [0, 1], { 1: [redact(1, 'r')] }))).toBe(true);
  });

  it('tolerates a page entry with no annotation list', () => {
    expect(hasRedactions(doc([page(0)], [0], {}))).toBe(false);
  });
});

describe('collectRedactions', () => {
  it('returns nothing when the document has no redactions', () => {
    expect(collectRedactions(doc([page(0)], [0], {})).size).toBe(0);
  });

  it('keys boxes by output page position, not source page index', () => {
    // Source page 1 is deleted, so its annotations must not leak onto the
    // remaining page, and source page 0 becomes output page 0.
    const result = collectRedactions(
      doc([page(0), page(1, { isDeleted: true })], [0, 1], {
        0: [redact(0, 'a')],
        1: [redact(1, 'b')],
      }),
    );
    expect(result.size).toBe(1);
    expect(result.get(0)).toHaveLength(1);
    expect(result.get(0)?.[0]?.id).toBeUndefined();
  });

  it('follows page reordering so boxes stay on their own page', () => {
    const result = collectRedactions(
      doc([page(0), page(1)], [1, 0], {
        0: [redact(0, 'on-first')],
        1: [redact(1, 'on-second')],
      }),
    );
    // Output order is source page 1 then source page 0.
    expect(result.get(0)?.[0]?.x).toBe(10);
    expect(result.get(1)?.[0]?.x).toBe(10);
    expect(result.size).toBe(2);
  });

  it('collects every box on a page', () => {
    const result = collectRedactions(
      doc([page(0)], [0], { 0: [redact(0, 'a', 1, 2), redact(0, 'b', 3, 4)] }),
    );
    expect(result.get(0)).toHaveLength(2);
    expect(result.get(0)?.map((r) => [r.x, r.y])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('preserves the requested colour and falls back to black', () => {
    const white = { ...redact(0, 'w'), color: '#ffffff' } as RedactionAnnotation;
    const missing = { ...redact(0, 'm'), color: undefined } as unknown as RedactionAnnotation;
    const result = collectRedactions(doc([page(0)], [0], { 0: [white, missing] }));
    expect(result.get(0)?.[0]?.color).toBe('#ffffff');
    expect(result.get(0)?.[1]?.color).toBe('#000000');
  });

  it('ignores deleted pages entirely', () => {
    const result = collectRedactions(
      doc([page(0, { isDeleted: true })], [0], { 0: [redact(0, 'a')] }),
    );
    expect(result.size).toBe(0);
  });

  it('ignores pages absent from pageOrder', () => {
    const result = collectRedactions(
      doc([page(0), page(1)], [0], { 1: [redact(1, 'a')] }),
    );
    expect(result.size).toBe(0);
  });
});

describe('redactedPageIndices', () => {
  it('is empty for a document with no annotations', () => {
    expect(redactedPageIndices(doc([page(0)], [0], {})).size).toBe(0);
  });

  it('reports source page indices, not output positions', () => {
    // Source page 1 is deleted, so it must not appear as a redacted page that
    // an office export would then try to skip.
    const result = redactedPageIndices(
      doc([page(0), page(1, { isDeleted: true })], [0, 1], { 1: [redact(1, 'a')] }),
    );
    expect(result.has(1)).toBe(true);
    expect(result.has(0)).toBe(false);
  });

  it('lists every page carrying a redaction', () => {
    const result = redactedPageIndices(
      doc([page(0), page(1), page(2)], [0, 1, 2], {
        0: [redact(0, 'a')],
        2: [redact(2, 'b')],
      }),
    );
    expect(Array.from(result).sort()).toEqual([0, 2]);
  });

  it('does not report pages holding only other annotation types', () => {
    const text: Annotation = { ...redact(0, 't'), type: 'text', text: 'hi' } as Annotation;
    expect(redactedPageIndices(doc([page(0)], [0], { 0: [text] })).size).toBe(0);
  });
});

describe('REDACTION_QUALITY', () => {
  it('offers a screen-oriented and a print-oriented resolution', () => {
    expect(REDACTION_QUALITY.standard).toBe(180);
    expect(REDACTION_QUALITY.print).toBe(300);
  });

  it('orders print above standard', () => {
    // The choice is presented as 1 = standard, 2 = print, so the higher
    // resolution must also be the numerically higher one.
    expect(REDACTION_QUALITY.print).toBeGreaterThan(REDACTION_QUALITY.standard);
  });
});
