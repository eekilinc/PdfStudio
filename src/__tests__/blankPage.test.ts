import { describe, it, expect, vi } from 'vitest';
import { detectVisibleContent, type BlanknessContext } from '../utils/blankPage';

/** A stand-in canvas that paints solid rows, so the sampler can be driven. */
function canvasOf(width: number, height: number, isInked: (y: number) => boolean) {
  const getImageData = vi.fn((sx: number, sy: number, sw: number, sh: number) => {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const inked = isInked(sy);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = inked ? 20 : 255;
      data[i + 1] = inked ? 20 : 255;
      data[i + 2] = inked ? 20 : 255;
      data[i + 3] = 255;
    }
    return { data };
  });
  return { ctx: { getImageData } as unknown as BlanknessContext, getImageData };
}

describe('detectVisibleContent', () => {
  it('reports a fully white page as blank', () => {
    const { ctx } = canvasOf(1000, 1400, () => false);
    expect(detectVisibleContent(ctx, 1000, 1400)).toBe(false);
  });

  it('reports a page with a text line as having content', () => {
    // Regression guard: a page carrying only a small footer used to be judged
    // blank, which turned the DOM text layer on and doubled the text over the
    // raster.
    const { ctx } = canvasOf(1000, 1400, (y) => y > 1200);
    expect(detectVisibleContent(ctx, 1000, 1400)).toBe(true);
  });

  it('ignores transparent pixels', () => {
    const { ctx } = canvasOf(1000, 1400, () => true);
    // Blank paper that happens to be fully transparent is still blank.
    const transparent = { getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4000) })) };
    expect(detectVisibleContent(transparent as unknown as BlanknessContext, 1000, 1400)).toBe(false);
    expect(detectVisibleContent(ctx, 1000, 1400)).toBe(true);
  });

  it('reads a bounded number of rows rather than the whole canvas', () => {
    // The cost that made zooming a hundred-page document allocate gigabytes.
    const { ctx, getImageData } = canvasOf(2000, 3000, () => true);
    detectVisibleContent(ctx, 2000, 3000);

    expect(getImageData).toHaveBeenCalled();
    const rows = getImageData.mock.calls.length;
    expect(rows).toBeLessThanOrEqual(24);
    // Every read is a single pixel row, never the full page.
    for (const [, sy, , sh] of getImageData.mock.calls) {
      expect(sh).toBe(1);
      expect(sy).toBeLessThan(3000);
    }
  });

  it('never reads more than a small fraction of the page area', () => {
    const width = 2000;
    const height = 3000;
    const { ctx, getImageData } = canvasOf(width, height, () => true);
    detectVisibleContent(ctx, width, height);

    const bytesRead = getImageData.mock.calls.reduce((sum, [, , sw, sh]) => sum + sw! * sh! * 4, 0);
    // The whole canvas would be 24 MB; sampling must be orders of magnitude less.
    expect(bytesRead).toBeLessThan(width * height * 4 * 0.02);
  });

  it('treats an unrendered canvas as having content', () => {
    // Otherwise the text layer would be exposed over a page that never drew.
    const { ctx } = canvasOf(1000, 1400, () => true);
    expect(detectVisibleContent(ctx, 0, 0)).toBe(true);
    expect(detectVisibleContent(ctx, -5, 100)).toBe(true);
  });

  it('falls back to content when the canvas cannot be read', () => {
    // A tainted canvas throws on read; reporting "blank" there would hide the
    // real page behind a duplicate text layer.
    const throwing = {
      getImageData: () => {
        throw new Error('tainted');
      },
    };
    expect(detectVisibleContent(throwing as unknown as BlanknessContext, 100, 100)).toBe(true);
  });

  it('does not let one dark speck make a page count as having content', () => {
    // The old rule needed eight hits and flipped on a single stray pixel.
    const width = 1000;
    const height = 1400;
    const data = new Uint8ClampedArray(width * 4).fill(255);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;

    const ctx: BlanknessContext = {
      getImageData: (_sx, _sy, sw) => {
        const row = new Uint8ClampedArray(sw * 4);
        for (let i = 0; i < row.length; i += 4) {
          row[i] = 255;
          row[i + 1] = 255;
          row[i + 2] = 255;
          row[i + 3] = 255;
        }
        // A single dark pixel in the first row only.
        if (_sy === 0) {
          row[0] = 0;
          row[1] = 0;
          row[2] = 0;
        }
        return { data: row };
      },
    };

    expect(detectVisibleContent(ctx, width, height)).toBe(false);
    expect(data.length).toBeGreaterThan(0);
  });
});
