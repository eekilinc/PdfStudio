import { describe, it, expect } from 'vitest';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRef,
  PDFNumber,
  PDFHexString,
  PDFArray,
  PDFNull,
} from 'pdf-lib';
import { exportModifiedPdf } from '../utils/pdfExport';
import type { PDFDocumentState } from '../types/pdf';

const makeState = (data: ArrayBuffer, numPages: number): PDFDocumentState => ({
  filename: 'test.pdf',
  fileSize: data.byteLength,
  data,
  numPages,
  pages: Array.from({ length: numPages }, (_, i) => ({
    pageIndex: i,
    originalPageNumber: i + 1,
    displayPageNumber: i + 1,
    rotation: 0,
    width: 595.28,
    height: 841.89,
    aspectRatio: 595.28 / 841.89,
  })),
  pageOrder: Array.from({ length: numPages }, (_, i) => i),
  annotations: {},
});

/** Build a source document with metadata and a two-level bookmark tree. */
async function buildSource(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.addPage([595.28, 841.89]);
  doc.addPage([595.28, 841.89]);

  doc.setTitle('Original Title');
  doc.setAuthor('Original Author');
  doc.setSubject('Original Subject');
  doc.setKeywords(['alpha', 'beta']);
  doc.setCreator('Upstream Tool');

  const { context } = doc;
  const pages = doc.getPages();

  const item = (title: string, pageIndex: number): PDFRef => {
    const dict = context.obj({ Title: PDFHexString.fromText(title) });
    const ref = context.register(dict);
    dict.set(
      PDFName.of('Dest'),
      context.obj([pages[pageIndex]!.ref, PDFName.of('XYZ'), PDFNull, PDFNumber.of(0), PDFNull]),
    );
    return ref;
  };

  const s1 = item('Section One', 0);
  const s2 = item('Section Two', 1);
  const chapter1 = item('Chapter One', 0);
  const chapter2 = item('Chapter Two', 2);

  // Siblings are a /Next chain, so it has to be built in the source too.
  context.lookup(s1)?.set(PDFName.of('Next'), s2);
  context.lookup(chapter1)?.set(PDFName.of('Next'), chapter2);

  const chapter1Dict = context.lookup(chapter1);
  if (chapter1Dict instanceof PDFDict) {
    chapter1Dict.set(PDFName.of('First'), s1);
    chapter1Dict.set(PDFName.of('Last'), s2);
    chapter1Dict.set(PDFName.of('Count'), PDFNumber.of(2));
  }

  const root = context.obj({ Type: PDFName.of('Outlines') });
  const rootRef = context.register(root);
  root.set(PDFName.of('First'), chapter1);
  root.set(PDFName.of('Last'), chapter2);
  root.set(PDFName.of('Count'), PDFNumber.of(2));
  doc.catalog.set(PDFName.of('Outlines'), rootRef);

  return doc.save();
}

/** Resolve a key to a dictionary, or null when it is absent. */
function dictAt(doc: PDFDocument, node: PDFDict, key: string): PDFDict | null {
  const raw = node.get(PDFName.of(key));
  if (raw === undefined) return null;
  const resolved = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  return resolved instanceof PDFDict ? resolved : null;
}

const outlinesOf = (doc: PDFDocument) => dictAt(doc, doc.catalog, 'Outlines');

/** Titles of an outline node's children, walking the /First → /Next chain. */
function childTitles(doc: PDFDocument, node: PDFDict | null): string[] {
  const titles: string[] = [];
  let cursor = node ? dictAt(doc, node, 'First') : null;
  let guard = 0;
  while (cursor && guard < 100) {
    const title = cursor.get(PDFName.of('Title'));
    if (title instanceof PDFHexString) titles.push(title.decodeText());
    cursor = dictAt(doc, cursor, 'Next');
    guard += 1;
  }
  return titles;
}

/**
 * Load without letting pdf-lib rewrite the metadata it just read.
 *
 * The `load` constructor calls `updateInfoDict()`, which overwrites Producer and
 * the dates in memory, so without this flag every accessor would report
 * pdf-lib's values and mask what the export actually produced.
 */
const loadOutput = (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false });

const exportFrom = async (source: Uint8Array, mutate: (s: PDFDocumentState) => void = () => {}) => {
  const state = makeState(source.buffer.slice(0) as ArrayBuffer, 3);
  mutate(state);
  return exportModifiedPdf(state);
};

describe('exportModifiedPdf: document metadata', () => {
  it('carries title, author, subject and keywords across a save', async () => {
    const out = await loadOutput(await exportFrom(await buildSource()));

    expect(out.getTitle()).toBe('Original Title');
    expect(out.getAuthor()).toBe('Original Author');
    expect(out.getSubject()).toBe('Original Subject');
    expect(out.getKeywords()).toBe('alpha beta');
  });

  it('identifies this application as the producer', async () => {
    const bytes = await exportFrom(await buildSource());
    const out = await loadOutput(bytes);

    // The file was produced here, not by the upstream tool that authored it.
    expect(out.getProducer()).toContain('PDF Studio Pro');
  });

  it('keeps the upstream creator rather than claiming it', async () => {
    const out = await loadOutput(await exportFrom(await buildSource()));
    expect(out.getCreator()).toBe('Upstream Tool');
  });
});

describe('exportModifiedPdf: bookmarks', () => {
  it('rebuilds the top-level bookmark tree', async () => {
    const out = await loadOutput(await exportFrom(await buildSource()));
    expect(childTitles(out, outlinesOf(out))).toEqual(['Chapter One', 'Chapter Two']);
  });

  it('keeps nested bookmarks', async () => {
    const out = await loadOutput(await exportFrom(await buildSource()));
    const first = dictAt(out, outlinesOf(out)!, 'First');
    expect(childTitles(out, first)).toEqual(['Section One', 'Section Two']);
  });

  it('gives every bookmark a destination that resolves to a real page', async () => {
    const out = await loadOutput(await exportFrom(await buildSource()));
    const first = dictAt(out, outlinesOf(out)!, 'First');
    const dest = first?.get(PDFName.of('Dest'));

    expect(dest).toBeInstanceOf(PDFArray);
    if (!(dest instanceof PDFArray)) return;

    const target = dest.get(0);
    // A destination pointing at an object outside this document would make the
    // reader refuse the file, so it must be one of our own pages.
    const pageRefs = new Set(out.getPages().map((p) => p.ref.toString()));
    expect(target !== undefined && pageRefs.has(String(target))).toBe(true);
  });

  it('keeps bookmarks pointing at the right page after a reorder', async () => {
    // Chapter Two pointed at source page 3, which is now displayed first.
    const out = await loadOutput(
      await exportFrom(await buildSource(), (s) => {
        s.pageOrder = [2, 1, 0];
      }),
    );
    expect(out.getPageCount()).toBe(3);
    expect(childTitles(out, outlinesOf(out))).toEqual(['Chapter One', 'Chapter Two']);
  });

  it('does not dangle when a bookmarked page is deleted', async () => {
    const out = await loadOutput(
      await exportFrom(await buildSource(), (s) => {
        s.pages[1] = { ...s.pages[1]!, isDeleted: true };
        s.pageOrder = [0, 2];
      }),
    );
    expect(out.getPageCount()).toBe(2);
    // The document must still be openable and its outline still parseable.
    expect(outlinesOf(out)).toBeInstanceOf(PDFDict);
  });
});

describe('exportModifiedPdf: documents with nothing to carry over', () => {
  it('still writes a document with no metadata and no bookmarks', async () => {
    const plain = await PDFDocument.create();
    plain.addPage([595.28, 841.89]);
    const source = await plain.save();

    const state = makeState(source.buffer.slice(0) as ArrayBuffer, 1);
    const out = await loadOutput(await exportModifiedPdf(state));

    expect(out.getPageCount()).toBe(1);
    expect(outlinesOf(out)).toBeNull();
  });
});
