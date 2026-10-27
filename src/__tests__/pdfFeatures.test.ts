import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFArray, PDFDict, PDFHexString, PDFName, PDFNull, PDFNumber, PDFRef, PDFString } from 'pdf-lib';
import { exportModifiedPdf } from '../utils/pdfExport';
import { readBookmarks, readComments, readFormFields, readLinks } from '../utils/pdfInspect';
import type { PDFDocumentState, PdfComment } from '../types/pdf';

/**
 * A source document with an interactive form and a hyperlink, built the way
 * a real producer would build it: a text field, a check box and a link
 * annotation on the page.
 */
async function buildSourcePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);

  const form = doc.getForm();
  const text = form.createTextField('ad soyad');
  text.addToPage(page, { x: 50, y: 700, width: 200, height: 24 });
  text.setText('Onceki Deger');

  const box = form.createCheckBox('onay');
  box.addToPage(page, { x: 50, y: 650, width: 20, height: 20 });

  const link = doc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: [10, 10, 200, 40],
    Border: [0, 0, 0],
  });
  // The link is appended, not written over: replacing the array would throw
  // away the widgets the form had just placed on the page.
  const existing = page.node.get(PDFName.of('Annots'));
  const annots = existing instanceof PDFArray ? existing : doc.context.obj([]);
  annots.push(doc.context.register(link));
  page.node.set(PDFName.of('Annots'), annots);

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

/** The annotations of a page, resolved. */
async function pageAnnotations(bytes: Uint8Array): Promise<PDFDict[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = doc.getPages()[0]!;
  const raw = page.node.get(PDFName.of('Annots'));
  const array = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  if (!(array instanceof PDFArray)) return [];
  return array
    .asArray()
    .map((entry) => (entry instanceof PDFRef ? doc.context.lookup(entry) : entry))
    .filter((entry): entry is PDFDict => entry instanceof PDFDict);
}

/** Decode a PDF string, whether it is stored literally or as hex. */
function textOf(value: unknown): string | undefined {
  if (value instanceof PDFHexString) return value.decodeText();
  if (value instanceof PDFString) return value.decodeText();
  if (value === undefined) return undefined;
  return String(value);
}

/**
 * Read an entry of the document information dictionary.
 *
 * `getProducer` cannot be used for the check: pdf-lib stamps its own name
 * over the producer of every document it loads, so the value it reports is
 * the one of the reader, not the one in the file.
 */
function infoEntry(doc: PDFDocument, key: string): string | undefined {
  const infoRef = doc.context.trailerInfo.Info;
  if (!(infoRef instanceof PDFRef)) return undefined;
  const info = doc.context.lookup(infoRef);
  if (!(info instanceof PDFDict)) return undefined;
  return textOf(info.get(PDFName.of(key)));
}

/** The page labels of a loaded document. */
function readPageLabels(doc: PDFDocument): Array<{ style: string; prefix?: string; first: number }> {
  const tree = doc.catalog.get(PDFName.of('PageLabels'));
  const dict = tree instanceof PDFRef ? doc.context.lookup(tree) : tree;
  if (!(dict instanceof PDFDict)) return [];

  const nums = dict.get(PDFName.of('Nums'));
  const array = nums instanceof PDFArray ? nums : null;
  if (!array) return [];

  const out: Array<{ style: string; prefix?: string; first: number }> = [];
  const entries = array.asArray();
  for (let i = 0; i + 1 < entries.length; i += 2) {
    const spec = entries[i + 1] instanceof PDFRef ? doc.context.lookup(entries[i + 1]!) : entries[i + 1];
    if (!(spec instanceof PDFDict)) continue;
    const style = spec.get(PDFName.of('S'));
    const prefix = spec.get(PDFName.of('P'));
    const first = spec.get(PDFName.of('St'));
    out.push({
      style: style instanceof PDFName ? style.asString().replace(/^\//, '') : 'D',
      prefix: prefix instanceof PDFString ? prefix.asString() : undefined,
      first: first instanceof PDFNumber ? first.asNumber() : 1,
    });
  }
  return out;
}

describe('exportModifiedPdf', () => {
  it('keeps the parts of the file it does not know about', async () => {
    // A document with an embedded file: the exporter never looks at it, so
    // writing the document in place has to keep it.
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    await source.attach(Buffer.from('gizli notlar'), 'text/plain', 'notlar.txt');
    source.setTitle('Etiketli Belge');
    const raw = await source.save();

    const bytes = await exportModifiedPdf(stateFor(raw));
    const out = await PDFDocument.load(bytes, { updateMetadata: false });

    // The embedded file tree is still in the catalog.
    const names = out.catalog.get(PDFName.of('Names'));
    expect(names).toBeDefined();

    // The metadata is carried over as well.
    expect(out.getTitle()).toBe('Etiketli Belge');
  });

  it('writes the document in place when the pages were not reordered', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pages = [
      {
        pageIndex: 0,
        originalPageNumber: 1,
        displayPageNumber: 1,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
      {
        pageIndex: 1,
        originalPageNumber: 2,
        displayPageNumber: 2,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
    ];
    state.pageOrder = [0, 1];

    const bytes = await exportModifiedPdf(state);
    const out = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(out.getPageCount()).toBe(2);
  });

  it('keeps the interactive form of the source document', async () => {
    const source = await buildSourcePdf();
    const bytes = await exportModifiedPdf(stateFor(source));

    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const fields = doc.getForm().getFields();

    // Before the fix the saved file held the widgets but no form at all, so
    // the fields had no name, no value and could not be filled in.
    expect(fields.map((f) => f.getName()).sort()).toEqual(['ad soyad', 'onay']);
    expect(doc.getForm().getTextField('ad soyad').getText()).toBe('Onceki Deger');
  });

  it('writes the values filled into the form', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.formValues = { 'ad soyad': 'Yeni Deger', onay: true };

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(doc.getForm().getTextField('ad soyad').getText()).toBe('Yeni Deger');
    expect(doc.getForm().getCheckBox('onay').isChecked()).toBe(true);
  });

  it('keeps hyperlinks of the source document', async () => {
    const source = await buildSourcePdf();
    const bytes = await exportModifiedPdf(stateFor(source));

    const annotations = await pageAnnotations(bytes);
    expect(annotations.some((a) => a.get(PDFName.of('Subtype'))?.toString() === '/Link')).toBe(true);
  });

  it('reads the hyperlinks of a document', async () => {
    const source = await buildSourcePdf();
    const links = await readLinks(source);

    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe('internal');
    expect(links[0]!.pageIndex).toBe(0);
  });

  it('writes a new hyperlink into the document', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.links = [
      {
        id: 'lnk-1',
        pageIndex: 0,
        kind: 'external',
        rect: { x: 40, y: 60, width: 120, height: 20 },
        url: 'https://example.com',
      },
    ];

    const bytes = await exportModifiedPdf(state);
    const links = await readLinks(bytes);

    const external = links.find((l) => l.kind === 'external');
    expect(external?.url).toBe('https://example.com');
    expect(external?.pageIndex).toBe(0);
  });

  it('points an internal hyperlink at the right page after a reorder', async () => {
    const source = await PDFDocument.create();
    const first = source.addPage([595.28, 841.89]);
    const second = source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pages = [
      {
        pageIndex: 0,
        originalPageNumber: 1,
        displayPageNumber: 1,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
      {
        pageIndex: 1,
        originalPageNumber: 2,
        displayPageNumber: 2,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
    ];
    // The pages are swapped, so a link that pointed at the second page has
    // to follow it.
    state.pageOrder = [1, 0];
    state.links = [
      {
        id: 'lnk-1',
        pageIndex: 0,
        kind: 'internal',
        rect: { x: 40, y: 60, width: 120, height: 20 },
        targetPageIndex: 1,
      },
    ];

    const bytes = await exportModifiedPdf(state);
    const links = await readLinks(bytes);

    const internal = links.find((l) => l.kind === 'internal');
    expect(internal).toBeDefined();
    // The second page of the source is now the first page of the output.
    expect(internal?.targetPageIndex).toBe(0);
    void first;
    void second;
  });

  it('removes a hyperlink when the inspector is asked to', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.links = [];
    state.sanitize = { links: true };

    const bytes = await exportModifiedPdf(state);
    const annotations = await pageAnnotations(bytes);

    expect(annotations.some((a) => a.get(PDFName.of('Subtype'))?.toString() === '/Link')).toBe(false);
  });

  it('writes comments as real PDF annotations', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    const comment: PdfComment = {
      id: 'cmt-1',
      pageIndex: 0,
      kind: 'note',
      rect: { x: 100, y: 200, width: 20, height: 20 },
      contents: 'Lütfen kontrol edin',
      author: 'Denetçi',
    };
    state.comments = [comment];

    const bytes = await exportModifiedPdf(state);
    const annotations = await pageAnnotations(bytes);

    const note = annotations.find((a) => a.get(PDFName.of('Subtype'))?.toString() === '/Text');
    expect(note).toBeDefined();
    expect(textOf(note!.get(PDFName.of('T')))).toBe('Denetçi');
    expect(textOf(note!.get(PDFName.of('NM')))).toBe('cmt-1');
    expect(textOf(note!.get(PDFName.of('Contents')))).toBe('Lütfen kontrol edin');

    // The comment survives a round trip through the reader as well.
    const read = await readComments(bytes);
    expect(read).toHaveLength(1);
    expect(read[0]!.contents).toBe('Lütfen kontrol edin');
    expect(read[0]!.author).toBe('Denetçi');
    expect(read[0]!.pageIndex).toBe(0);
  });

  it('writes a reply as a child of its comment', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.comments = [
      {
        id: 'cmt-1',
        pageIndex: 0,
        kind: 'note',
        rect: { x: 100, y: 200, width: 20, height: 20 },
        contents: 'Ana yorum',
        author: 'Denetçi',
      },
      {
        id: 'cmt-2',
        pageIndex: 0,
        kind: 'note',
        rect: { x: 100, y: 200, width: 20, height: 20 },
        contents: 'Yanıt',
        author: 'Yönetici',
        parentId: 'cmt-1',
      },
    ];

    const bytes = await exportModifiedPdf(state);
    const read = await readComments(bytes);

    expect(read).toHaveLength(2);
    const reply = read.find((c) => c.contents === 'Yanıt');
    expect(reply?.parentId).toBe('cmt-1');
  });

  it('removes the comments of the file when the inspector is asked to', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.comments = [
      {
        id: 'cmt-1',
        pageIndex: 0,
        kind: 'note',
        rect: { x: 100, y: 200, width: 20, height: 20 },
        contents: 'Silinecek yorum',
        author: 'Denetçi',
      },
    ];
    state.sanitize = { comments: true };

    const bytes = await exportModifiedPdf(state);
    const annotations = await pageAnnotations(bytes);

    expect(annotations.some((a) => a.get(PDFName.of('Subtype'))?.toString() === '/Text')).toBe(false);
  });

  it('removes the hyperlinks when the inspector is asked to', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.sanitize = { links: true };

    const bytes = await exportModifiedPdf(state);
    const annotations = await pageAnnotations(bytes);

    expect(annotations.some((a) => a.get(PDFName.of('Subtype'))?.toString() === '/Link')).toBe(false);
  });

  it('removes the form when the inspector is asked to', async () => {
    const source = await buildSourcePdf();
    const state = stateFor(source);
    state.sanitize = { formFields: true };

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it('writes the page labels into the document', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pageLabels = [
      { startPage: 0, style: 'r', first: 1 },
      { startPage: 0, style: 'D', first: 1, prefix: 'A-' },
    ];

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    const labels = readPageLabels(doc);
    expect(labels).toHaveLength(2);
    expect(labels[0]!.style).toBe('r');
    expect(labels[1]!.prefix).toBe('A-');
  });

  it('writes a page transition into the document', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pageTransitions = [{ pageIndex: 0, style: 'Fade', duration: 0.5 }];

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    const page = doc.getPages()[0]!;
    const trans = page.node.get(PDFName.of('Trans'));
    expect(trans).toBeDefined();

    const dict = trans instanceof PDFRef ? doc.context.lookup(trans) : trans;
    if (dict instanceof PDFDict) {
      expect(dict.get(PDFName.of('S'))?.toString()).toBe('/Fade');
      expect(dict.get(PDFName.of('D'))?.toString()).toBe('0.5');
    }
  });

  it('writes a page box into the document', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pageBoxes = [
      { pageIndex: 0, box: 'CropBox', left: 10, bottom: 20, right: 30, top: 40 },
    ];

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    const page = doc.getPages()[0]!;
    const crop = page.node.get(PDFName.of('CropBox'));
    const values = crop instanceof PDFArray
      ? crop.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : -1))
      : [];

    expect(values[0]).toBeCloseTo(10);
    expect(values[1]).toBeCloseTo(20);
    expect(values[2]).toBeCloseTo(595.28 - 30);
    expect(values[3]).toBeCloseTo(841.89 - 40);
  });

  it('reads the form fields of a document', async () => {    const source = await buildSourcePdf();
    const fields = await readFormFields(source);

    const text = fields.find((f) => f.name === 'ad soyad');
    expect(text?.kind).toBe('text');
    expect(text?.value).toBe('Onceki Deger');

    const box = fields.find((f) => f.name === 'onay');
    expect(box?.kind).toBe('checkbox');
    expect(box?.value).toBe(false);
  });

  it('writes the bookmarks of the document into the file', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    source.addPage([595.28, 841.89]);
    const raw = await source.save();

    const state = stateFor(raw);
    state.pages = [
      {
        pageIndex: 0,
        originalPageNumber: 1,
        displayPageNumber: 1,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
      {
        pageIndex: 1,
        originalPageNumber: 2,
        displayPageNumber: 2,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        aspectRatio: 595.28 / 841.89,
      },
    ];
    state.bookmarks = [
      { id: 'bmk-1', title: 'Giriş', pageIndex: 0 },
      {
        id: 'bmk-2',
        title: 'Bölümler',
        pageIndex: 1,
        children: [{ id: 'bmk-3', title: 'Alt bölüm', pageIndex: 1 }],
      },
    ];

    const bytes = await exportModifiedPdf(state);
    const bookmarks = await readBookmarks(bytes);

    expect(bookmarks.map((b) => b.title)).toEqual(['Giriş', 'Bölümler']);
    expect(bookmarks[0]!.pageIndex).toBe(0);
    expect(bookmarks[1]!.children?.[0]?.title).toBe('Alt bölüm');
  });

  it('reads the bookmarks of a document', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([595.28, 841.89]);
    const outline = source.context.obj({
      Title: PDFHexString.fromText('Başlık'),
      Dest: [page.ref, PDFName.of('XYZ'), PDFNull, PDFNumber.of(120), PDFNull],
    });
    const outlineRef = source.context.register(outline);
    const root = source.context.obj({ Type: PDFName.of('Outlines'), First: outlineRef, Last: outlineRef, Count: PDFNumber.of(1) });
    source.catalog.set(PDFName.of('Outlines'), source.context.register(root));
    const raw = await source.save();

    const bookmarks = await readBookmarks(raw);

    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]!.title).toBe('Başlık');
    expect(bookmarks[0]!.pageIndex).toBe(0);
  });

  it('keeps the bookmarks of a document whose outline could not be read', async () => {
    // A document without an outline in the app's list keeps the one it came
    // with, because the app did not take it over.
    const source = await PDFDocument.create();
    const page = source.addPage([595.28, 841.89]);
    const outline = source.context.obj({
      Title: PDFHexString.fromText('Başlık'),
      Dest: [page.ref, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull],
    });
    const outlineRef = source.context.register(outline);
    const root = source.context.obj({ Type: PDFName.of('Outlines'), First: outlineRef, Last: outlineRef, Count: PDFNumber.of(1) });
    source.catalog.set(PDFName.of('Outlines'), source.context.register(root));
    const raw = await source.save();

    const state = stateFor(raw);
    delete state.bookmarks;

    const bytes = await exportModifiedPdf(state);
    const bookmarks = await readBookmarks(bytes);

    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]!.title).toBe('Başlık');
  });
});

describe('document inspector', () => {
  it('keeps the document information of the source', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    source.setTitle('Belge Basligi');
    source.setAuthor('Yazar');
    const raw = await source.save();

    const bytes = await exportModifiedPdf(stateFor(raw));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(infoEntry(doc, 'Title')).toBe('Belge Basligi');
    expect(infoEntry(doc, 'Author')).toBe('Yazar');
    expect(infoEntry(doc, 'Producer')).toContain('PDF Studio');
  });

  it('drops the document information when the inspector is asked to', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    source.setTitle('Gizli Baslik');
    source.setAuthor('Gizli Yazar');
    const raw = await source.save();

    const state = stateFor(raw);
    state.sanitize = { metadata: true };

    const bytes = await exportModifiedPdf(state);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(infoEntry(doc, 'Title')).toBeUndefined();
    expect(infoEntry(doc, 'Author')).toBeUndefined();
    expect(infoEntry(doc, 'Producer')).toBeUndefined();
  });
});
