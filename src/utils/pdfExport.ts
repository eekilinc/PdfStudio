import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFRef,
  PDFString,
  rgb,
  degrees,
  StandardFonts,
  PDFPage,
  LineCapStyle,
} from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { applyRedactions, collectRedactions, type RedactionQuality } from './redaction';
import { APP_NAME, APP_VERSION } from '../version';
import type { Annotation, PDFDocumentState, TextAnnotation, DrawingAnnotation, ShapeAnnotation, SignatureAnnotation, StampAnnotation } from '../types/pdf';

/**
 * Fold a string to the WinAnsi range used by the PDF standard-14 fonts.
 *
 * WinAnsiEncoding is CP1252-shaped: slots 0xA0-0xFF follow Latin-1, so the
 * Turkish letters that Latin-1 contains — ç Ç ö Ö ü Ü — are already encodable
 * and are left alone. Folding them to ASCII, as this function used to, needlessly
 * corrupted Turkish words in the exported document's own text layer.
 *
 * The remaining Turkish letters have no WinAnsi slot at all: ğ Ğ ş Ş ı İ live
 * above U+00FF and cannot be represented, so they are transliterated to their
 * nearest ASCII rather than dropped, which would leave holes mid-word.
 */
export function toWinAnsi(str: string): string {
  if (!str) return '';
  return (
    str
      // Typographic punctuation with a direct WinAnsi equivalent. These are
      // ASCII stand-ins because pdf-lib's WinAnsi encoder has no glyph slot for
      // the curly variants; dropping them would run words together.
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/\u0192/g, 'f')
      .replace(/[\u2039\u203A]/g, ' ')
      .replace(/\u2030/g, '%')
      .replace(/[\u02C6\u02DC]/g, '~')
      .replace(/[\u02DD\u02DB]/g, '"')
      .replace(/\u02DA/g, 'o')
      .replace(/[\u2020\u2021]/g, '+')
      .replace(/\u0152/g, 'OE')
      .replace(/\u0153/g, 'oe')
      .replace(/\u0160/g, 'S')
      .replace(/\u017D/g, 'Z')
      .replace(/\u017E/g, 'z')
      .replace(/\u0178/g, 'Y')
      // Turkish letters with no WinAnsi slot. Latin-1 covers ç Ç ö Ö ü Ü, which
      // are left alone above; these four pairs sit above U+00FF and simply are
      // not representable in the standard-14 fonts. Each pattern is
      // case-preserving so the leading capital of a word survives.
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      // Anything still outside the encodable set is removed rather than
      // substituted, since a wrong glyph would misrepresent the text.
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
  );
}

/**
 * Carry the source document's metadata across.
 *
 * The exporter builds a fresh document and copies pages, so without this every
 * save dropped the title, author, subject, keywords and producer. Those are the
 * fields a reader sees in their file properties, and a document that had been
 * catalogued would silently lose its catalogue record on the first Ctrl+S.
 *
 * `setProducer` and `setCreator` are intentionally *not* copied: they identify
 * the tool, and the output really was produced by this application. The creation
 * date is left for pdf-lib to stamp, since a round trip should reflect when the
 * file was last written.
 */
function copyDocumentInfo(srcDoc: PDFDocument, outDoc: PDFDocument): void {
  const copyString = (read: () => string | undefined, write: (value: string) => void) => {
    try {
      const value = read();
      if (value) write(value);
    } catch {
      // A malformed /Info entry must not abort the save.
    }
  };

  copyString(() => srcDoc.getTitle(), (v) => outDoc.setTitle(v));
  copyString(() => srcDoc.getAuthor(), (v) => outDoc.setAuthor(v));
  copyString(() => srcDoc.getSubject(), (v) => outDoc.setSubject(v));
  copyString(() => srcDoc.getKeywords(), (v) => outDoc.setKeywords([v]));

  outDoc.setProducer(`${APP_NAME} ${APP_VERSION}`);
  outDoc.setCreator(srcDoc.getCreator() ?? APP_NAME);

  // Only the creation date is carried over. pdf-lib refreshes the modification
  // date on every save, which is correct: the file *was* just modified.
  try {
    const created = srcDoc.getCreationDate();
    if (created) outDoc.setCreationDate(created);
  } catch {
    // Ignore a missing or unparsable date.
  }
}

/**
 * Rebuild the source document's bookmark tree in the output.
 *
 * The tree is walked from the raw outline dictionary rather than through a
 * higher-level API because destinations must be re-pointed: the source refers to
 * its own page objects, and after reordering, deletion or a redaction raster
 * those objects are not the pages in the output any more. `outlineRemap` maps an
 * output page back to the source page number it was copied from, which is the
 * only stable identity available across the copy.
 */
async function copyOutlines(
  srcDoc: PDFDocument,
  outDoc: PDFDocument,
  outlineRemap: Map<PDFRef, number>,
): Promise<void> {
  if (outlineRemap.size === 0) return;

  try {
    // `lookup` throws when the key is absent, and `get` returns the raw entry,
    // which for a cross-reference is a PDFRef rather than the dictionary.
    const raw = srcDoc.catalog.get(PDFName.of('Outlines'));
    if (raw === undefined) return;
    const srcRoot = raw instanceof PDFRef ? srcDoc.context.lookup(raw) : raw;
    if (!(srcRoot instanceof PDFDict)) return;

    // Source page number -> the page in the output that came from it.
    const outputPageBySource = new Map<number, PDFPage>();
    for (const [ref, sourceNumber] of outlineRemap) {
      const page = outDoc.getPages().find((p) => p.ref === ref);
      if (page) outputPageBySource.set(sourceNumber, page);
    }
    if (outputPageBySource.size === 0) return;

    /**
     * Source page number keyed by the page's dictionary.
     *
     * Matching is on the dictionary rather than by searching the page list for
     * the destination's first element, because that element is a reference, not
     * a `PDFPage` instance.
     */
    const sourceNumberByDict = new Map<PDFDict, number>();
    srcDoc.getPages().forEach((page, i) => {
      sourceNumberByDict.set(page.node as unknown as PDFDict, i + 1);
    });

    /** Destination inside the source document, resolved to an output page. */
    const resolveDestination = (node: PDFDict): { page: PDFPage; top: number } | null => {
      const dest = node.get(PDFName.of('Dest'));
      if (!dest) return null;

      let array: unknown[] | null = null;
      if (dest instanceof PDFArray) {
        array = dest.asArray();
      } else if (dest instanceof PDFDict) {
        // A named destination: /D holds the real array.
        const named = dest.get(PDFName.of('D'));
        if (named instanceof PDFArray) array = named.asArray();
      }
      if (!array || array.length === 0) return null;

      const target = array[0];
      if (target === undefined) return null;
      // A parsed document keeps indirect entries as references; a destination
      // built in memory may hold the dictionary directly. Handle both.
      const targetDict = target instanceof PDFRef ? srcDoc.context.lookup(target) : target;
      if (!(targetDict instanceof PDFDict)) return null;

      const sourceNumber = sourceNumberByDict.get(targetDict);
      const page = sourceNumber !== undefined ? outputPageBySource.get(sourceNumber) : undefined;
      if (!page) return null;

      // The vertical offset is optional; PDFNull means "top of the page".
      const rawTop = array[1];
      const top = rawTop instanceof PDFNumber ? rawTop.asNumber() : 0;
      return { page, top };
    };

    const textOf = (node: PDFDict): string => {
      const title = node.get(PDFName.of('Title'));
      if (title instanceof PDFHexString) {
        // PDFHexString decodes UTF-16BE, which is how non-Latin titles are stored.
        try {
          return title.decodeText();
        } catch {
          return title.asString();
        }
      }
      if (title instanceof PDFName) return title.decodeText();
      if (title instanceof PDFString) return title.decodeText();
      return '';
    };

    /** Resolve a key on `node` to a dictionary, or null if it is absent. */
    const dictAt = (node: PDFDict, key: string): PDFDict | null => {
      const raw = node.get(PDFName.of(key));
      if (raw === undefined) return null;
      const resolved = raw instanceof PDFRef ? srcDoc.context.lookup(raw) : raw;
      return resolved instanceof PDFDict ? resolved : null;
    };

    const childrenOf = (node: PDFDict): PDFDict[] => {
      const children: PDFDict[] = [];
      let cursor = dictAt(node, 'First');
      // The sibling list is a linked list; the bound guards against a cycle in
      // a malformed file rather than trusting the input.
      while (cursor && children.length < 10_000) {
        children.push(cursor);
        cursor = dictAt(cursor, 'Next');
      }
      return children;
    };

    let created = 0;

    // An outline item is a plain dictionary; pdf-lib exposes no builder, and a
    // bare object carries no reference until the context registers it, so each
    // item is registered here and the sibling links are wired by hand.
    const copyLevel = (nodes: PDFDict[], parentRef?: PDFRef): PDFRef[] => {
      const built: Array<{ dict: PDFDict; ref: PDFRef }> = [];
      for (const node of nodes) {
        const title = textOf(node);
        if (!title) continue;

        const outline = outDoc.context.obj({ Title: PDFHexString.fromText(title) });
        const outlineRef = outDoc.context.register(outline);
        created += 1;

        const resolved = resolveDestination(node);
        if (resolved) {
          outline.set(
            PDFName.of('Dest'),
            outDoc.context.obj([
              resolved.page.ref,
              PDFName.of('XYZ'),
              PDFNull,
              PDFNumber.of(resolved.top),
              PDFNull,
            ]),
          );
        }

        if (parentRef) outline.set(PDFName.of('Parent'), parentRef);
        built.push({ dict: outline, ref: outlineRef });

        const children = childrenOf(node);
        if (children.length > 0) {
          const builtChildren = copyLevel(children, outlineRef);
          if (builtChildren.length > 0) {
            outline.set(PDFName.of('First'), builtChildren[0]!);
            outline.set(PDFName.of('Last'), builtChildren[builtChildren.length - 1]!);
            outline.set(PDFName.of('Count'), PDFNumber.of(builtChildren.length));
          }
        }
      }

      // Siblings are a /Next chain. Without it only the first bookmark of each
      // level would be reachable, and the rest would silently vanish.
      for (let i = 0; i < built.length - 1; i += 1) {
        built[i]!.dict.set(PDFName.of('Next'), built[i + 1]!.ref);
      }

      return built.map((b) => b.ref);
    };

    const roots = childrenOf(srcRoot);
    if (roots.length === 0) return;

    const top = copyLevel(roots);
    if (top.length > 0 && created > 0) {
      const root = outDoc.context.obj({ Type: PDFName.of('Outlines') });
      const rootRef = outDoc.context.register(root);
      root.set(PDFName.of('First'), top[0]!);
      root.set(PDFName.of('Last'), top[top.length - 1]!);
      root.set(PDFName.of('Count'), PDFNumber.of(top.length));
      outDoc.catalog.set(PDFName.of('Outlines'), rootRef);
    }
  } catch (err) {
    // Losing bookmarks is a real loss, so it is reported, but it must not stop
    // the document from being written.
    console.warn('Bookmarks could not be carried over:', err);
  }
}

/**
 * Resolve a family + weight pair to one of the four embedded standard fonts.
 *
 * The weight has to be decided *inside* the family branches. Checking weight
 * first and family second let the family test overwrite it, so a bold
 * "Times New Roman" annotation exported as regular Times.
 */
/** The six standard-14 faces the exporter embeds. */
interface ExportFonts {
  Helvetica: PDFFont;
  HelveticaBold: PDFFont;
  Times: PDFFont;
  TimesBold: PDFFont;
  Courier: PDFFont;
  CourierBold: PDFFont;
}

function pickFont(
  fontFamily: string | undefined,
  fontWeight: string | undefined,
  fonts: ExportFonts,
): PDFFont {
  const isBold = fontWeight === 'bold';
  const family = (fontFamily ?? '').toLowerCase();

  if (family.includes('times') || family.includes('serif') || family.includes('georgia') || family.includes('garamond')) {
    return isBold ? fonts.TimesBold : fonts.Times;
  }
  if (family.includes('courier') || family.includes('mono') || family.includes('consolas')) {
    return isBold ? fonts.CourierBold : fonts.Courier;
  }
  // Helvetica is the fallback: only the standard-14 faces are embedded, so an
  // arbitrary family name cannot be honoured and must not crash the export.
  return isBold ? fonts.HelveticaBold : fonts.Helvetica;
}

// Parse hex color string '#RRGGBB' to pdf-lib rgb(r, g, b)
export function hexToRgb(hex: string) {
  if (!hex || hex === 'transparent') return null;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return rgb(0, 0, 0);
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Serialise the document to PDF bytes, annotations included.
 *
 * @param onRedactionProgress Progress callback for the rasterisation step that
 *   permanently destroys redacted pages. See `utils/redaction.ts`.
 */
export async function exportModifiedPdf(
  docState: PDFDocumentState,
  options: {
    /** Progress of the permanent-redaction rasterisation step, 0-100. */
    onRedactionProgress?: (percent: number) => void;
    /**
     * Called with the types of annotations that could not be written. The save
     * still succeeds, so the caller is expected to warn the user.
     */
    onAnnotationFailure?: (types: string[]) => void;
    /** Raster resolution for redacted pages. Ignored if there are none. */
    redactionQuality?: RedactionQuality;
  } = {},
): Promise<Uint8Array> {
  if (!docState.data) {
    throw new Error('No PDF document loaded.');
  }

  // Load existing PDF document
  const srcDoc = await PDFDocument.load(docState.data);
  const outDoc = await PDFDocument.create();

  // Pre-embed standard fonts. The bold faces of Times and Courier are embedded
  // too, so a bold serif or monospace annotation exports bold instead of
  // silently losing its weight.
  const fontHelvetica = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await outDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await outDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontCourier = await outDoc.embedFont(StandardFonts.Courier);
  const fontCourierBold = await outDoc.embedFont(StandardFonts.CourierBold);

  // Copy pages in the desired order (filtering out deleted ones)
  const validPageIndices = docState.pageOrder.filter(idx => {
    const pageState = docState.pages.find(p => p.pageIndex === idx);
    return pageState && !pageState.isDeleted;
  });

  if (validPageIndices.length === 0) {
    throw new Error('Belgede kaydedilecek sayfa bulunamadı.');
  }

  // Destination page object in the output document -> its source page number.
  // Populated while pages are written, consumed when the outline is rebuilt.
  const outlineRemap = new Map<PDFRef, number>();

  for (let i = 0; i < validPageIndices.length; i++) {
    const pageIndex = validPageIndices[i];
    if (pageIndex === undefined) continue;
    const pageState = docState.pages.find(p => p.pageIndex === pageIndex);
    if (!pageState) continue;

    let outPage: PDFPage;

    if (pageState.isBlank || pageState.originalPageNumber === 0) {
      // Create a pristine blank page
      outPage = outDoc.addPage([pageState.width || 595.28, pageState.height || 841.89]);
    } else {
      // Copy existing page from source doc
      const [copiedPage] = await outDoc.copyPages(srcDoc, [pageState.originalPageNumber - 1]);
      outPage = outDoc.addPage(copiedPage);
    }

    // Bookmark destinations refer to pages by *object reference*, so after a
    // reorder, a deletion or an inserted blank page the original references no
    // longer point at the right sheet. Capturing the index here and patching the
    // outline after the loop is what keeps navigation landing correctly.
    outlineRemap.set(outPage.ref, pageState.originalPageNumber);

    // Apply rotation
    if (pageState && pageState.rotation !== undefined) {
      const currentRot = outPage.getRotation().angle;
      outPage.setRotation(degrees((currentRot + pageState.rotation) % 360));
    }

    // Get current page dimensions for coordinate matching
    const { width: _pWidth, height: pHeight } = outPage.getSize();

    // Render annotations for this page
    const pageAnnotations = docState.annotations[pageIndex] || [];
    const failed: Annotation[] = [];

    for (const ann of pageAnnotations) {
      try {
        await renderAnnotationToPdfPage(ann, outPage, outDoc, pHeight, {
          Helvetica: fontHelvetica,
          HelveticaBold: fontHelveticaBold,
          Times: fontTimes,
          TimesBold: fontTimesBold,
          Courier: fontCourier,
          CourierBold: fontCourierBold,
        });
      } catch (err) {
        // Collected rather than merely logged: a silently dropped signature or
        // stamp is worse than a visible warning, because the user is told the
        // save succeeded.
        console.error('Annotation render error for', ann.id, err);
        failed.push(ann);
      }
    }

    if (failed.length > 0) options.onAnnotationFailure?.(failed.map((a) => a.type));
  }

  // Everything below runs before `save`, and all of it is best-effort: failing to
  // carry a bookmark or a metadata field across must never cost the user their
  // actual edits.

  copyDocumentInfo(srcDoc, outDoc);
  await copyOutlines(srcDoc, outDoc, outlineRemap);

  const bytes = await outDoc.save();

  // Destroy redacted pages, if any. Runs after the vector pass so the
  // re-render also captures the other annotations flattened into the page.
  return await applyRedactions(
    bytes,
    collectRedactions(docState),
    options.onRedactionProgress,
    options.redactionQuality,
  );
}

async function renderAnnotationToPdfPage(
  ann: Annotation,
  page: PDFPage,
  doc: PDFDocument,
  pHeight: number,
  fonts: ExportFonts
) {
  // Convert standard coordinate system (Origin at top-left in web canvas vs bottom-left in PDF)
  // ann.y in canvas is from top, so pdfY = pHeight - ann.y - ann.height (or specific point)

  const strokeColor = hexToRgb(ann.color) || rgb(0, 0, 0);
  const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;

  switch (ann.type) {
    // Redaction is deliberately not drawn here. Painting a rectangle leaves the
    // text underneath intact in the content stream, which is exactly the
    // failure mode permanent redaction exists to prevent. The boxes are instead
    // collected and destroyed by `applyRedactions`, which rasterises the page.

    case 'rect': {
      const shape = ann as ShapeAnnotation;
      const pdfY = pHeight - shape.y - shape.height;
      const fillRgb = shape.fillColor && shape.fillColor !== 'transparent' ? hexToRgb(shape.fillColor) : undefined;
      page.drawRectangle({
        x: shape.x,
        y: pdfY,
        width: shape.width,
        height: shape.height,
        borderColor: strokeColor,
        borderWidth: shape.strokeWidth || 2,
        color: fillRgb || undefined,
        opacity: opacity,
      });
      break;
    }

    case 'circle': {
      const shape = ann as ShapeAnnotation;
      const radiusX = shape.width / 2;
      const radiusY = shape.height / 2;
      const centerX = shape.x + radiusX;
      const centerY = pHeight - (shape.y + radiusY);
      const fillRgb = shape.fillColor && shape.fillColor !== 'transparent' ? hexToRgb(shape.fillColor) : undefined;

      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: radiusX,
        yScale: radiusY,
        borderColor: strokeColor,
        borderWidth: shape.strokeWidth || 2,
        color: fillRgb || undefined,
        opacity: opacity,
      });
      break;
    }

    case 'line': {
      const shape = ann as ShapeAnnotation;
      const startX = shape.x;
      const startY = pHeight - shape.y;
      const endX = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
      const endY = pHeight - (shape.endY !== undefined ? shape.endY : shape.y + shape.height);

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: shape.strokeWidth || 2,
        color: strokeColor,
        opacity: opacity,
      });
      break;
    }

    case 'arrow': {
      const shape = ann as ShapeAnnotation;
      const startX = shape.x;
      const startY = pHeight - shape.y;
      const endX = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
      const endY = pHeight - (shape.endY !== undefined ? shape.endY : shape.y + shape.height);
      const thickness = shape.strokeWidth || 2;

      // Draw main line
      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });

      // Calculate arrow head points
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = Math.max(12, thickness * 4);
      const arrowAngle = Math.PI / 6; // 30 degrees

      const leftX = endX - headLen * Math.cos(angle - arrowAngle);
      const leftY = endY - headLen * Math.sin(angle - arrowAngle);
      const rightX = endX - headLen * Math.cos(angle + arrowAngle);
      const rightY = endY - headLen * Math.sin(angle + arrowAngle);

      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: leftX, y: leftY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });

      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: rightX, y: rightY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });
      break;
    }

    case 'pen':
    case 'highlighter': {
      const drawAnn = ann as DrawingAnnotation;
      if (!drawAnn.points || drawAnn.points.length < 2) break;

      const isHighlighter = drawAnn.type === 'highlighter';
      const drawOpacity = isHighlighter ? (drawAnn.opacity || 0.4) : (drawAnn.opacity || 1.0);
      const thickness = drawAnn.strokeWidth || (isHighlighter ? 18 : 3);

      for (let i = 0; i < drawAnn.points.length - 1; i++) {
        const p1 = drawAnn.points[i];
        const p2 = drawAnn.points[i + 1];
        if (!p1 || !p2) continue;

        page.drawLine({
          start: { x: p1.x, y: pHeight - p1.y },
          end: { x: p2.x, y: pHeight - p2.y },
          thickness: thickness,
          color: strokeColor,
          opacity: drawOpacity,
          lineCap: LineCapStyle.Round,
        });
      }
      break;
    }

    case 'text': {
      const textAnn = ann as TextAnnotation;
      const font = pickFont(textAnn.fontFamily, textAnn.fontWeight, fonts);

      const fontSize = textAnn.fontSize || 14;
      // Text is drawn on its baseline, which sits a descender below the box the
      // viewer lays out. Centring the baseline in that box keeps the exported
      // text where the preview showed it.
      const pdfY = pHeight - textAnn.y - fontSize * 0.8;

      // Draw background if present
      if (textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent') {
        const bgRgb = hexToRgb(textAnn.backgroundColor);
        if (bgRgb) {
          page.drawRectangle({
            x: textAnn.x - 4,
            y: pdfY - 4,
            width: textAnn.width + 8,
            height: textAnn.height + 8,
            color: bgRgb,
            opacity: 0.9,
          });
        }
      }

      // Handle multi-line text
      const lines = textAnn.text.split('\n');
      const lineHeight = fontSize * 1.25;

      lines.forEach((line, lineIndex) => {
        if (!line.trim() && lines.length === 1) return;
        const safeLine = toWinAnsi(line);
        if (!safeLine) return;

        // Honour the alignment the toolbar offers. Previously `textAlign` was
        // ignored and every line was left-aligned, so a centred watermark
        // exported flush left.
        const lineWidth = font.widthOfTextAtSize(safeLine, fontSize);
        const boxWidth = textAnn.width || lineWidth;
        const drawX =
          textAnn.textAlign === 'center'
            ? textAnn.x + (boxWidth - lineWidth) / 2
            : textAnn.textAlign === 'right'
              ? textAnn.x + boxWidth - lineWidth
              : textAnn.x;

        const drawOptions = {
          x: drawX,
          y: pdfY - lineIndex * lineHeight,
          size: fontSize,
          font,
          color: strokeColor,
          opacity,
          // Without this a rotated annotation exported upright.
          ...(textAnn.rotation ? { rotate: degrees(textAnn.rotation) } : {}),
        };

        if (textAnn.rotation) {
          // pdf-lib rotates about (x, y), so the origin has to move to the box
          // centre for the text to pivot where the viewer showed it.
          const cx = textAnn.x + (textAnn.width || lineWidth) / 2;
          const cy = pHeight - textAnn.y - (textAnn.height || fontSize);
          drawOptions.x = cx;
          drawOptions.y = cy;
        }

        page.drawText(safeLine, drawOptions);
      });
      break;
    }

    case 'signature': {
      const sigAnn = ann as SignatureAnnotation;
      if (!sigAnn.imageData) break;

      try {
        const imageBytes = await fetch(sigAnn.imageData).then(res => res.arrayBuffer());
        const pngImage = await doc.embedPng(imageBytes);
        const pdfY = pHeight - sigAnn.y - sigAnn.height;

        page.drawImage(pngImage, {
          x: sigAnn.x,
          y: pdfY,
          width: sigAnn.width,
          height: sigAnn.height,
          opacity: opacity,
        });
      } catch (e) {
        console.error('Failed to embed signature PNG:', e);
      }
      break;
    }

    case 'stamp': {
      const stampAnn = ann as StampAnnotation;
      const pdfY = pHeight - stampAnn.y - stampAnn.height;
      const stampColor = hexToRgb(stampAnn.color || '#e11d48') || rgb(0.88, 0.11, 0.28);

      // Draw Stamp Outer Double Border
      page.drawRectangle({
        x: stampAnn.x,
        y: pdfY,
        width: stampAnn.width,
        height: stampAnn.height,
        borderColor: stampColor,
        borderWidth: 3,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });

      page.drawRectangle({
        x: stampAnn.x + 3,
        y: pdfY + 3,
        width: stampAnn.width - 6,
        height: stampAnn.height - 6,
        borderColor: stampColor,
        borderWidth: 1,
        opacity: 0.9,
      });

      const mainText = toWinAnsi(stampAnn.customText || stampAnn.stampType);
      const font = fonts.HelveticaBold;
      const textWidth = font.widthOfTextAtSize(mainText, 16);
      const textX = stampAnn.x + (stampAnn.width - textWidth) / 2;
      const textY = pdfY + stampAnn.height / 2 - 5;

      page.drawText(mainText, {
        x: Math.max(stampAnn.x + 6, textX),
        y: textY,
        size: 16,
        font: font,
        color: stampColor,
      });

      if (stampAnn.date || stampAnn.subtitle) {
        const sub = toWinAnsi(stampAnn.date || stampAnn.subtitle || '');
        const subFont = fonts.Helvetica;
        const subWidth = subFont.widthOfTextAtSize(sub, 9);
        const subX = stampAnn.x + (stampAnn.width - subWidth) / 2;
        page.drawText(sub, {
          x: Math.max(stampAnn.x + 6, subX),
          y: textY - 14,
          size: 9,
          font: subFont,
          color: stampColor,
        });
      }
      break;
    }

    case 'image': {
      const imgAnn = ann as any;
      if (!imgAnn.imageData) break;

      try {
        const imageBytes = await fetch(imgAnn.imageData).then((res) => res.arrayBuffer());
        const isPng = imgAnn.imageData.includes('image/png') || imgAnn.imageData.startsWith('data:image/png');
        const pdfImage = isPng ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
        const pdfY = pHeight - imgAnn.y - imgAnn.height;

        page.drawImage(pdfImage, {
          x: imgAnn.x,
          y: pdfY,
          width: imgAnn.width,
          height: imgAnn.height,
          opacity: opacity,
        });
      } catch (e) {
        console.error('Failed to embed image:', e);
      }
      break;
    }

    case 'measure': {
      const measureAnn = ann as any;
      const startX = measureAnn.x;
      const startY = pHeight - measureAnn.y;
      const endX = measureAnn.endX !== undefined ? measureAnn.endX : measureAnn.x + measureAnn.width;
      const endY = pHeight - (measureAnn.endY !== undefined ? measureAnn.endY : measureAnn.y + measureAnn.height);
      const color = hexToRgb(measureAnn.color || '#f59e0b') || rgb(0.96, 0.62, 0.04);

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: 2,
        color: color,
        opacity: opacity,
      });

      const text = toWinAnsi(measureAnn.distanceFormatted || '0 cm');
      const font = fonts.HelveticaBold;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + 5;
      page.drawText(text, {
        x: midX,
        y: midY,
        size: 10,
        font: font,
        color: color,
      });
      break;
    }

    case 'checkbox': {
      const cbAnn = ann as any;
      const pdfY = pHeight - cbAnn.y - cbAnn.height;
      const color = hexToRgb(cbAnn.color || '#0f172a') || rgb(0.1, 0.1, 0.2);

      page.drawRectangle({
        x: cbAnn.x,
        y: pdfY,
        width: cbAnn.width || 18,
        height: cbAnn.height || 18,
        borderColor: color,
        borderWidth: 1.5,
        color: rgb(1, 1, 1),
      });

      if (cbAnn.checked) {
        page.drawLine({
          start: { x: cbAnn.x + 3, y: pdfY + 9 },
          end: { x: cbAnn.x + 7, y: pdfY + 4 },
          thickness: 2,
          color: color,
        });
        page.drawLine({
          start: { x: cbAnn.x + 7, y: pdfY + 4 },
          end: { x: cbAnn.x + 14, y: pdfY + 14 },
          thickness: 2,
          color: color,
        });
      }
      break;
    }
  }
}

export async function createBlankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]); // Standard A4 (595.28 x 841.89 pt)
  return await doc.save();
}
