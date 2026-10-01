import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSharedPdfDoc, releasePdfDoc, clearPdfCache } from '../utils/pdfInit';

// The module reaches for a worker URL and pdf.js proper, neither of which
// exists in this environment, so both are replaced with a controllable double.
const getDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: (...args: unknown[]) => getDocument(...args),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker-stub' }));

/** A minimal stand-in for the parts of the PDF.js surface we touch. */
function fakeDoc(name: string) {
  return { name, numPages: 1 } as unknown;
}

/**
 * The shape `getDocument` must return: a loading task carrying `destroy` — which
 * is what releases the worker-side document — and the document promise.
 */
function taskFor(doc: unknown) {
  return { promise: Promise.resolve(doc), destroy: vi.fn().mockResolvedValue(undefined) };
}

function stubOpen(name: string) {
  // The same instance goes into the promise, so identity assertions hold.
  const doc = fakeDoc(name);
  const task = taskFor(doc);
  getDocument.mockReturnValue(task);
  return { task, doc };
}

const bufferOf = (size = 16) => new ArrayBuffer(size);

describe('getSharedPdfDoc', () => {
  beforeEach(() => {
    getDocument.mockReset();
    clearPdfCache();
  });

  it('returns null when there is no data', async () => {
    expect(await getSharedPdfDoc(null)).toBeNull();
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('parses a document once and reuses it', async () => {
    // The whole point of the cache: pages, thumbnails and the search pass all
    // ask for the same document, and only the first ask may pay for a parse.
    const { doc } = stubOpen('a');
    const data = bufferOf();

    const results = await Promise.all([
      getSharedPdfDoc(data),
      getSharedPdfDoc(data),
      getSharedPdfDoc(data),
    ]);

    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(doc);
    expect(results[1]).toBe(doc);
    expect(results[2]).toBe(doc);
  });

  it('gives each document its own entry', async () => {
    // A single-slot cache evicted the first document when a second was opened,
    // which is what made switching tabs re-parse the whole file.
    stubOpen('a');
    const first = bufferOf();
    await getSharedPdfDoc(first);

    const secondDoc = fakeDoc('b');
    getDocument.mockReturnValue(taskFor(secondDoc));
    const second = bufferOf(32);

    const a = await getSharedPdfDoc(first);
    const b = await getSharedPdfDoc(second);

    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(a).not.toBe(b);
  });

  it('still serves the first document after a second is opened', async () => {
    stubOpen('a');
    const first = bufferOf();
    const a1 = await getSharedPdfDoc(first);

    getDocument.mockReturnValue(taskFor(fakeDoc('b')));
    await getSharedPdfDoc(bufferOf(32));

    // No re-parse, and the same handle as before.
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(await getSharedPdfDoc(first)).toBe(a1);
  });

  it('gives PDF.js a copy so the application buffer is not detached', async () => {
    // PDF.js transfers the array it is handed, which would leave the rest of the
    // app holding a detached buffer.
    stubOpen('a');
    const data = bufferOf();
    await getSharedPdfDoc(data);

    const passed = getDocument.mock.calls[0]![0] as { data: ArrayBuffer };
    expect(passed.data).not.toBe(data);
    expect(passed.data.byteLength).toBe(data.byteLength);
  });

  it('retries once when the first attempt fails', async () => {
    getDocument
      .mockReturnValueOnce({ promise: Promise.reject(new Error('bad stream')), destroy: vi.fn() })
      .mockReturnValueOnce(taskFor(fakeDoc('recovered')));

    const doc = await getSharedPdfDoc(bufferOf());
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(doc).toBeTruthy();
  });

  it('does not cache a document that failed to open', async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error('corrupt')), destroy: vi.fn() });
    await expect(getSharedPdfDoc(bufferOf())).rejects.toThrow();

    // A later attempt must try again rather than replay the cached failure.
    getDocument.mockReturnValue(taskFor(fakeDoc('later')));
    const doc = await getSharedPdfDoc(bufferOf());
    expect(doc).toBeTruthy();
  });
});

describe('releasePdfDoc', () => {
  beforeEach(() => {
    getDocument.mockReset();
    clearPdfCache();
  });

  it('destroys the worker-side document', async () => {
    // Dropping the reference is not enough: the worker keeps decoded pages and
    // images for a document until it is told otherwise.
    const { task } = stubOpen('a');
    const data = bufferOf();
    await getSharedPdfDoc(data);

    await releasePdfDoc(data);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('re-parses after release, since the handle is gone', async () => {
    stubOpen('a');
    const data = bufferOf();
    await getSharedPdfDoc(data);
    await releasePdfDoc(data);

    getDocument.mockReturnValue(taskFor(fakeDoc('again')));
    await getSharedPdfDoc(data);
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for data it has never seen', async () => {
    await expect(releasePdfDoc(bufferOf())).resolves.toBeUndefined();
    await expect(releasePdfDoc(null)).resolves.toBeUndefined();
  });

  it('survives a document that fails to open', async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error('corrupt')), destroy: vi.fn() });
    await expect(getSharedPdfDoc(bufferOf())).rejects.toThrow();
    await expect(releasePdfDoc(bufferOf())).resolves.toBeUndefined();
  });
});

describe('clearPdfCache', () => {
  beforeEach(() => {
    getDocument.mockReset();
  });

  it('releases every cached document', async () => {
    const a = stubOpen('a');
    await getSharedPdfDoc(bufferOf());
    const b = stubOpen('b');
    await getSharedPdfDoc(bufferOf(32));

    clearPdfCache();
    expect(a.task.destroy).toHaveBeenCalledTimes(1);
    expect(b.task.destroy).toHaveBeenCalledTimes(1);
  });
});
