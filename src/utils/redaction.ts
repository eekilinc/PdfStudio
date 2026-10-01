import { PDFDocument, PDFName } from 'pdf-lib';
import { pdfjsLib } from './pdfInit';
import type { PDFDocumentState, RedactionAnnotation } from '../types/pdf';

/**
 * Permanent redaction.
 *
 * A black rectangle painted over the content stream is *not* redaction: the text
 * underneath stays in the file and remains selectable, copyable, searchable and
 * extractable by any PDF parser. This module destroys it for real.
 *
 * The approach is to rasterise only the pages that actually carry a redaction.
 * For each such page the exported document is re-rendered at high resolution —
 * which also captures the vector annotations already flattened into it — the
 * boxes are burned into the pixels, and the page's content stream is then
 * discarded and replaced by a single image. With no operators and no font
 * resources left on the page, the covered characters are genuinely gone: not
 * hidden, not covered, removed.
 *
 * The trade-off is explicit and unavoidable. A redacted page becomes a raster
 * image and loses its text layer, because destroying text means removing the
 * operators that draw it and pdf-lib cannot rewrite a content stream safely.
 * Pages without a redaction stay vector and keep their text.
 */

/** A redaction box in PDF point space, measured from the page's top-left. */
export interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/**
 * Rendered resolutions for redacted pages, in DPI.
 *
 * Redaction output is a raster, so its quality is chosen here rather than by the
 * viewer. The default keeps a redacted page legible on screen and in print at
 * ordinary zoom; the higher option exists for documents that will be printed or
 * archived, where the extra fidelity is worth the larger file.
 */
export const REDACTION_QUALITY = {
  /** 180 DPI — legible on screen, modest file size. */
  standard: 180,
  /** 300 DPI — print and archival grade. */
  print: 300,
} as const;

export type RedactionQuality = keyof typeof REDACTION_QUALITY;

const DEFAULT_REDACTION_QUALITY: RedactionQuality = 'standard';

/**
 * Upper bound on a redacted page's pixel count, roughly 40 megapixels.
 *
 * Rasterising is the memory-hungry part of this feature. A poster-sized page
 * would otherwise ask for a canvas the renderer cannot allocate, so oversized
 * pages are rendered at a reduced scale instead of failing the save.
 */
const MAX_REDACTED_PIXELS = 40_000_000;

/** True when the document carries at least one redaction box. */
export function hasRedactions(docState: PDFDocumentState): boolean {
  return Object.values(docState.annotations).some(
    (list) => list?.some((ann) => ann.type === 'redact') ?? false,
  );
}

/**
 * Source page indices that carry at least one redaction box.
 *
 * Office exports read the source document, which still contains the redacted
 * text, so these pages have to be excluded from such an export rather than
 * converted. Keyed by source page index, matching `PDFDocumentState.pages`.
 */
export function redactedPageIndices(docState: PDFDocumentState): Set<number> {
  const pages = new Set<number>();
  for (const [pageIndex, list] of Object.entries(docState.annotations)) {
    if (list?.some((ann) => ann.type === 'redact')) pages.add(Number(pageIndex));
  }
  return pages;
}

/**
 * Gather redaction boxes keyed by their position in the *output* document.
 *
 * The key is the output page index (0-based, matching the order
 * `exportModifiedPdf` writes pages in) rather than the source page index, so
 * boxes stay attached to the right page after deletions and reordering.
 */
export function collectRedactions(docState: PDFDocumentState): Map<number, RedactionRect[]> {
  const byOutputPage = new Map<number, RedactionRect[]>();

  const validPageIndices = docState.pageOrder.filter((idx) => {
    const pageState = docState.pages.find((p) => p.pageIndex === idx);
    return pageState && !pageState.isDeleted;
  });

  validPageIndices.forEach((pageIndex, outputPosition) => {
    const redactions = (docState.annotations[pageIndex] ?? []).filter(
      (ann): ann is RedactionAnnotation => ann.type === 'redact',
    );
    if (redactions.length === 0) return;

    byOutputPage.set(
      outputPosition,
      redactions.map((ann) => ({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        color: ann.color || '#000000',
      })),
    );
  });

  return byOutputPage;
}

/**
 * Destroy redacted pages in `bytes` and return a new document.
 *
 * @param bytes        A freshly exported PDF.
 * @param byOutputPage Redaction boxes keyed by output page index.
 * @param onProgress   Optional progress callback receiving 0-100.
 * @throws If the document cannot be re-opened or a page cannot be re-rendered.
 *   Failing loudly is deliberate: quietly returning an unredacted document would
 *   be the exact outcome this feature exists to prevent.
 */
export async function applyRedactions(
  bytes: Uint8Array,
  byOutputPage: Map<number, RedactionRect[]>,
  onProgress?: (percent: number) => void,
  quality: RedactionQuality = DEFAULT_REDACTION_QUALITY,
): Promise<Uint8Array> {
  if (byOutputPage.size === 0) return bytes;

  // The bytes are fresh, so parse them directly rather than through the shared
  // cache — going through it would evict the document the viewer is rendering.
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const rendered = await loadingTask.promise;
  const outDoc = await PDFDocument.load(bytes);
  const targets = Array.from(byOutputPage.entries());

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const [outputPosition, rects] = targets[i]!;
      const pageNumber = outputPosition + 1;
      if (pageNumber > outDoc.getPageCount()) continue;

      const pdfPage = await rendered.getPage(pageNumber);
      const outPage = outDoc.getPage(outputPosition);
      const { width: pageWidth, height: pageHeight } = outPage.getSize();
      const rotation = outPage.getRotation().angle;

      const unit = pdfPage.getViewport({ scale: 1, rotation });
      const scale = Math.min(
        REDACTION_QUALITY[quality] / 72,
        Math.sqrt(MAX_REDACTED_PIXELS / Math.max(1, unit.width * unit.height)),
      );
      const viewport = pdfPage.getViewport({ scale, rotation });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(`Sayfa ${pageNumber}: çizim alanı oluşturulamadı.`);

      const renderTask = pdfPage.render({
        canvasContext: ctx,
        viewport,
        canvas,
      } as Parameters<typeof pdfPage.render>[0]);
      await renderTask.promise;

      // Map each box through the viewport so page size and rotation are honoured.
      for (const rect of rects) {
        // Annotation space has a top-left origin, PDF space a bottom-left one.
        const top = pageHeight - rect.y;
        const bottom = pageHeight - rect.y - rect.height;
        // pdf.js 6 dropped `convertToViewportRectangle`, so map the two corners
        // and derive the bounds. Under 90/270 rotation the two corners come back
        // in the other order, hence the min/max on both axes.
        const [ax, ay] = viewport.convertToViewportPoint(rect.x, bottom);
        const [bx, by] = viewport.convertToViewportPoint(rect.x + rect.width, top);

        const left = Math.min(ax, bx);
        const right = Math.max(ax, bx);
        const boxTop = Math.min(ay, by);
        const boxBottom = Math.max(ay, by);

        ctx.fillStyle = toCssColor(rect.color);
        // Fully opaque. A partially transparent box would let through the very
        // pixels it is meant to destroy.
        ctx.fillRect(left, boxTop, right - left, boxBottom - boxTop);
      }

      // PNG, not JPEG: lossy compression leaves recoverable structure in the
      // redacted pixels, which defeats the point of the feature.
      const image = await outDoc.embedPng(dataUrlToBytes(canvas.toDataURL('image/png')));

      // Drop everything that could still carry the text — the content stream,
      // the resource dictionary holding the fonts, and any link annotations —
      // then cover the page with the raster.
      outPage.node.delete(PDFName.of('Contents'));
      outPage.node.delete(PDFName.of('Resources'));
      outPage.node.delete(PDFName.of('Annots'));
      outPage.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });

      onProgress?.(Math.round(((i + 1) / targets.length) * 100));

      // Release the page proxy now; it holds the decoded operator list.
      pdfPage.cleanup();
    }
  } finally {
    // Without this the source document's worker-side resources outlive the call.
    await loadingTask.destroy();
  }

  return await outDoc.save();
}

/** Parse `#RGB` / `#RRGGBB` into a CSS colour, defaulting to opaque black. */
function toCssColor(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    const [r, g, b] = clean.split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^[0-9a-f]{6}$/i.test(clean) ? `#${clean}` : '#000000';
}

/** Decode a `data:` URL into raw bytes without a `fetch` round trip. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
