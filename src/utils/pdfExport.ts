import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, LineCapStyle } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { applyRedactions, collectRedactions, type RedactionQuality } from './redaction';
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
