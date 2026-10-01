/**
 * Deciding whether a rendered page has visible content.
 *
 * The renderer needs to know this to choose between two text-layer modes: when
 * the page's own pixels are visible the DOM text is made transparent so only
 * the raster shows, and when the page looks blank the DOM text is shown instead,
 * which is what makes a text-only or badly rasterised page readable.
 *
 * The previous implementation called `getImageData(0, 0, w, h)` on the whole
 * canvas to sample about three thousand bytes. At 180 DPI an A4 page is roughly
 * 3 megapixels, so every render allocated and read about 12 MB of pixel data per
 * page, and a hundred-page document churned over a gigabyte on a single zoom
 * step. Sampling whole rows instead reads the same information for a few
 * kilobytes.
 */

/** Anything darker than this counts as content rather than paper. */
const INK_THRESHOLD = 235;

/** Alpha below this is treated as transparent paper. */
const ALPHA_THRESHOLD = 30;

/** Rows sampled across the page. Enough to catch text on any real layout. */
const SAMPLE_ROWS = 24;

/** Share of sampled pixels that must be inked before the page counts as having content. */
const CONTENT_RATIO = 0.004;

export interface BlanknessContext {
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray };
}

/**
 * Whether a rendered page shows anything.
 *
 * @param ctx    A 2D context for the page canvas.
 * @param width  Canvas width in device pixels.
 * @param height Canvas height in device pixels.
 * @returns True when the page has visible content. A zero-sized canvas counts as
 *   having content, so the text layer is not exposed over a page that never drew.
 */
export function detectVisibleContent(ctx: BlanknessContext, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return true;

  const rows = Math.min(SAMPLE_ROWS, height);
  let inked = 0;
  let sampled = 0;

  for (let r = 0; r < rows; r += 1) {
    // One pixel row, spread evenly down the page.
    const y = Math.min(height - 1, Math.floor(((r + 0.5) / rows) * height));

    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, y, width, 1).data;
    } catch {
      // A tainted or unavailable canvas must not be reported as blank, or the
      // text layer would cover content the user can actually see.
      return true;
    }

    // Every fourth pixel is enough to characterise a row and keeps the cost
    // proportional to the sampling rather than to the page.
    for (let x = 0; x < data.length; x += 16) {
      const alpha = data[x + 3] ?? 0;
      if (alpha < ALPHA_THRESHOLD) continue;
      sampled += 1;
      const r8 = data[x] ?? 0;
      const g8 = data[x + 1] ?? 0;
      const b8 = data[x + 2] ?? 0;
      if (r8 < INK_THRESHOLD || g8 < INK_THRESHOLD || b8 < INK_THRESHOLD) inked += 1;
    }
  }

  if (sampled === 0) return false;
  return inked / sampled >= CONTENT_RATIO;
}
