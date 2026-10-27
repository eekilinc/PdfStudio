import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { readAttachments, readAttachmentBytes, readLayers } from '../utils/pdfInspect';
import { exportModifiedPdf } from '../utils/pdfExport';
import type { PDFDocumentState } from '../types/pdf';

/**
 * A document with a layer and an attached file.
 *
 * Both are built the way a producer would build them: the layer is an
 * optional content group the page points at, the file is in the name tree
 * of the catalog.
 */
async function buildDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);

  const group = doc.context.obj({ Type: PDFName.of('OCG'), Name: PDFName.of('Arka Plan') });
  const groupRef = doc.context.register(group);

  const resources = page.node.Resources();
  const properties = doc.context.obj({ Layer1: groupRef });
  if (resources) {
    resources.set(PDFName.of('Properties'), doc.context.register(properties));
  }

  const config = doc.context.obj({
    OCGs: doc.context.obj([groupRef]),
    D: doc.context.obj({ OFF: doc.context.obj([groupRef]), BaseState: PDFName.of('ON') }),
  });
  doc.catalog.set(PDFName.of('OCProperties'), doc.context.register(config));

  // An attached file.
  const fileBytes = new TextEncoder().encode('gömülü dosyanın içeriği');
  const fileStream = doc.context.flateStream(fileBytes);
  const fileRef = doc.context.register(fileStream);
  fileStream.dict.set(PDFName.of('Type'), PDFName.of('EmbeddedFile'));
  fileStream.dict.set(PDFName.of('Subtype'), PDFName.of('text/plain'));
  fileStream.dict.set(
    PDFName.of('Params'),
    doc.context.register(doc.context.obj({ Size: fileBytes.length })),
  );

  const spec = doc.context.obj({
    Type: PDFName.of('Filespec'),
    F: PDFString.of('notlar.txt'),
    UF: PDFString.of('notlar.txt'),
    // A description with letters outside the plain encoding is written as
    // hex, the way a producer writes it.
    Desc: PDFHexString.fromText('Sözleşme notları'),
    EF: doc.context.obj({ F: fileRef, UF: fileRef }),
  });
  const specRef = doc.context.register(spec);

  const names = doc.context.obj({
    EmbeddedFiles: doc.context.register(
      doc.context.obj({ Names: doc.context.obj([PDFString.of('notlar.txt'), specRef]) }),
    ),
  });
  doc.catalog.set(PDFName.of('Names'), doc.context.register(names));

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

describe('layers', () => {
  it('reads the layers of a document and their state', async () => {
    const source = await buildDocument();
    const layers = await readLayers(source);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.name).toBe('Arka Plan');
    // The layer is in the list of the ones that are turned off.
    expect(layers[0]!.visible).toBe(false);
    expect(layers[0]!.pageIndexes).toEqual([0]);
  });

  it('turns a layer on when the document is written', async () => {
    const source = await buildDocument();
    const state = stateFor(source);
    state.layerVisibility = { 'Arka Plan': true };

    const bytes = await exportModifiedPdf(state);
    const layers = await readLayers(bytes);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.visible).toBe(true);
  });

  it('keeps the layers of a document whose pages were reordered', async () => {
    const source = await buildDocument();
    const state = stateFor(source);
    state.layerVisibility = { 'Arka Plan': true };

    // The page is turned, so the document is rebuilt; the layers have to
    // survive that as well.
    state.pages = [
      {
        ...state.pages[0]!,
        rotation: 90,
      },
    ];

    const bytes = await exportModifiedPdf(state);
    const layers = await readLayers(bytes);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.name).toBe('Arka Plan');
    expect(layers[0]!.visible).toBe(true);
  });
});

describe('embedded files', () => {
  it('reads the files that are attached to a document', async () => {
    const source = await buildDocument();
    const attachments = await readAttachments(source);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.name).toBe('notlar.txt');
    expect(attachments[0]!.description).toBe('Sözleşme notları');
    expect(attachments[0]!.size).toBeGreaterThan(0);
  });

  it('reads the bytes of an attached file', async () => {
    const source = await buildDocument();
    const bytes = await readAttachmentBytes(source, 'notlar.txt');

    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes!)).toContain('gömülü dosyanın içeriği');
  });

  it('keeps the attached files of a document', async () => {
    const source = await buildDocument();
    const bytes = await exportModifiedPdf(stateFor(source));

    const attachments = await readAttachments(bytes);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.name).toBe('notlar.txt');
  });
});
