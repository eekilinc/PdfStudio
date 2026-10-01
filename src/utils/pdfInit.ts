import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js local bundled worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/** The document handle PDF.js hands back, as far as we use it. */
export type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

/** The loading task, which is what owns the worker and can be torn down. */
type PdfLoadingTask = ReturnType<typeof pdfjsLib.getDocument>;

/**
 * Parsed documents, keyed by the buffer they came from.
 *
 * This used to be a single slot. Every page, thumbnail, search pass and modal
 * went through it, so the second document to be opened — a second tab, the
 * comparison view — evicted the first, and switching tabs re-parsed the whole
 * file from scratch every time. On a 50-page document that is the entire file
 * copied and parsed again, per switch.
 *
 * The *promise* is stored rather than the document so that concurrent callers —
 * which is exactly what a multi-page render is — share one parse instead of
 * racing to start several.
 *
 * A `Map` is used rather than a `WeakMap` so the cache can be enumerated when the
 * workspace is torn down. That means the map holds the buffers strongly, which
 * would leak on its own, so {@link registry} removes entries as soon as the
 * application drops its own reference.
 */
const parsed = new Map<ArrayBuffer, CacheEntry>();

/**
 * Unregister tokens, keyed by buffer.
 *
 * `FinalizationRegistry.register` requires the target, the held value and the
 * unregister token to be three distinct objects, so a token per entry is kept
 * here rather than reusing the buffer.
 */
const tokens = new Map<ArrayBuffer, object>();

/** Release one cache entry, swallowing anything the teardown throws. */
function dispose(entry: CacheEntry | undefined): void {
  if (!entry) return;
  // The loading task owns the worker-side document: destroying it releases the
  // decoded operator lists, page cache and images the worker was holding.
  void entry.task.destroy().catch(() => {
    // Already destroyed, or never finished opening.
  });
}

/**
 * Drops a cache entry once the application stops referencing its buffer.
 *
 * Without this the `Map` would keep every document ever opened alive, which is
 * the same leak the old single-slot cache had in a different shape.
 */
const registry = new FinalizationRegistry<CacheEntry>((entry) => {
  // The finalizer fires once the *buffer* is unreachable, so nothing is left
  // holding a key to look this entry up by — hence the entry is the payload and
  // the buffer is found by identity.
  for (const [buffer, cached] of parsed) {
    if (cached !== entry) continue;
    parsed.delete(buffer);
    tokens.delete(buffer);
    break;
  }
  dispose(entry);
});

/**
 * Whether PDF.js is allowed to keep the buffer we hand it.
 *
 * PDF.js transfers and neuters the array it is given, so each attempt is made on
 * a copy. That copy is the price of a shared handle; the alternative — handing
 * over the app's own buffer — would leave the rest of the application holding a
 * detached array.
 */
function openDocument(data: ArrayBuffer): { task: PdfLoadingTask; doc: Promise<PdfDocument> } {
  const task = pdfjsLib.getDocument({
    data: data.slice(0),
    disableFontFace: false,
    cMapPacked: true,
    enableXfa: true,
  });
  return { task, doc: task.promise };
}

/** A cached document and the handle needed to release it. */
interface CacheEntry {
  task: PdfLoadingTask;
  doc: Promise<PdfDocument>;
}

/**
 * The parsed document for `data`, parsing it at most once.
 *
 * @returns The document, or null when there is no data.
 */
export async function getSharedPdfDoc(data: ArrayBuffer | null): Promise<PdfDocument | null> {
  if (!data) return null;

  const existing = parsed.get(data);
  if (existing) return existing.doc;

  const first = openDocument(data);
  const entry: CacheEntry = {
    task: first.task,
    doc: first.doc.catch(async (err: unknown) => {
      console.error('Error loading shared PDF:', err);
      // Retry once with the bare minimum of options: a file that trips an
      // optional feature should still open.
      const fallback = openDocument(data);
      entry.task = fallback.task;
      return fallback.doc;
    }),
  };

  parsed.set(data, entry);
  const token = {};
  tokens.set(data, token);
  // Target, held value and unregister token must be three distinct objects, so
  // the entry is held and a fresh token is minted per document.
  registry.register(data, entry, token);

  try {
    return await entry.doc;
  } catch (err) {
    // A failed parse must not be cached, or every later caller would replay it.
    if (parsed.get(data) === entry) {
      parsed.delete(data);
      const owned = tokens.get(data);
      if (owned) {
        registry.unregister(owned);
        tokens.delete(data);
      }
    }
    console.error('Error loading shared PDF fallback:', err);
    throw err;
  }
}

/**
 * Release the cached document for one buffer.
 *
 * Clearing the reference is not enough: the PDF.js worker holds decoded operator
 * lists, page caches and image data for a document until it is told otherwise.
 * Without this an editing session grew steadily until the tab ran out of memory.
 */
export async function releasePdfDoc(data: ArrayBuffer | null): Promise<void> {
  if (!data) return;
  const entry = parsed.get(data);
  if (!entry) return;
  parsed.delete(data);
  const token = tokens.get(data);
  if (token) {
    registry.unregister(token);
    tokens.delete(data);
  }
  try {
    await entry.task.destroy();
  } catch {
    // Already destroyed, or never opened. Nothing to reclaim.
  }
}

/** Release every cached document. */
export function clearPdfCache(): void {
  for (const [buffer, entry] of parsed) {
    const token = tokens.get(buffer);
    if (token) registry.unregister(token);
    dispose(entry);
  }
  parsed.clear();
  tokens.clear();
}

export { pdfjsLib };
