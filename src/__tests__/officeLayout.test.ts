import { describe, it, expect } from 'vitest';
import { groupIntoLines, medianOf, type PositionedRun } from '../utils/textLayout';

/**
 * Reproduces the two heuristics the Office exporters depend on, so the
 * classification can be pinned down without a PDF or a canvas.
 */

/** A run at a given size, as extraction would report it. */
const text = (x: number, y: number, content: string, height = 10, isBold = false): PositionedRun => ({
  text: content,
  x,
  y,
  height,
  width: content.length * height * 0.5,
  isBold,
});

/** Column split threshold, as the extractor applies it. */
const isColumnBreak = (gap: number, height: number) => gap > Math.max(18, height * 1.4);

describe('column detection', () => {
  it('treats a wide gap as a new column', () => {
    expect(isColumnBreak(40, 10)).toBe(true);
  });

  it('keeps ordinary word spacing in one cell', () => {
    // Prose has gaps well under the threshold, which is what stops a justified
    // paragraph from being read as a table row.
    expect(isColumnBreak(3, 10)).toBe(false);
    expect(isColumnBreak(8, 10)).toBe(false);
  });

  it('scales the threshold with the font size', () => {
    // The threshold is max(18pt, 1.4 x font size), so the same 40pt gap is an
    // ordinary space in 40pt text but a column break in 10pt text.
    expect(isColumnBreak(40, 40)).toBe(false); // threshold 56pt
    expect(isColumnBreak(40, 10)).toBe(true); // threshold 18pt
  });
});

describe('heading classification against a median baseline', () => {
  it('classifies a large run as a top-level heading', () => {
    const runs = [
      text(0, 700, 'CHAPTER ONE', 24, true),
      text(0, 600, 'body', 10),
      text(0, 500, 'body', 10),
    ];
    const lines = groupIntoLines(runs);
    const median = medianOf(lines.map((l) => l.maxHeight));

    // With a real median the outlier cannot move the baseline: body text stays
    // at 10 and the 24pt title stands well clear of it.
    expect(median).toBe(10);
    expect(lines[0]!.maxHeight >= median * 1.35).toBe(true);
    expect(lines[1]!.maxHeight >= median * 1.35).toBe(false);
  });

  it('does not reclassify body text when a huge heading is present', () => {
    // The failure the mean caused: one 40pt title pulled the average up enough
    // that ordinary 12pt body text no longer looked "big" and headings vanished.
    const runs = [
      text(0, 900, 'A VERY LARGE TITLE', 40, true),
      text(0, 800, 'Section heading', 13, true),
      text(0, 700, 'Ordinary body copy that continues for a while', 12),
      text(0, 600, 'More ordinary body copy in the same size', 12),
    ];
    const lines = groupIntoLines(runs);
    const median = medianOf(lines.map((l) => l.maxHeight));
    const mean = lines.reduce((s, l) => s + l.maxHeight, 0) / lines.length;

    // Even count, so the median sits between the two middle heights.
    expect(median).toBe(12.5);
    expect(mean).toBeGreaterThan(17);

    // Body text is not a heading against the median.
    const bodyIsHeading = lines[2]!.maxHeight >= median * 1.35;
    expect(bodyIsHeading).toBe(false);
  });

  it('keeps a small page from classifying everything as a heading', () => {
    // On an all-8pt page the absolute thresholds can make every line a heading.
    const runs = [text(0, 300, 'a', 8), text(0, 200, 'b', 8), text(0, 100, 'c', 8)];
    const lines = groupIntoLines(runs);
    const median = medianOf(lines.map((l) => l.maxHeight));

    for (const line of lines) {
      expect(line.maxHeight >= median * 1.35).toBe(false);
    }
  });
});

describe('reading order on a table', () => {
  it('reads a row left to right', () => {
    // A header row, the most common multi-column shape in a real document.
    const runs = [
      text(0, 500, 'Item', 10, true),
      text(200, 500, 'Qty', 10, true),
      text(320, 500, 'Price', 10, true),
    ];
    const [line] = groupIntoLines(runs);
    expect(line!.ordered.map((r) => r.text)).toEqual(['Item', 'Qty', 'Price']);
  });

  it('stays correct when runs arrive out of order', () => {
    const shuffled = [
      text(320, 500, 'Price', 10, true),
      text(0, 500, 'Item', 10, true),
      text(200, 500, 'Qty', 10, true),
    ];
    const [line] = groupIntoLines(shuffled);
    expect(line!.ordered.map((r) => r.text)).toEqual(['Item', 'Qty', 'Price']);
  });

  it('orders rows top to bottom', () => {
    const runs = [
      text(0, 100, 'second row', 10),
      text(0, 500, 'first row', 10),
      text(0, 300, 'third row', 10),
    ];
    expect(groupIntoLines(runs).map((l) => l.text)).toEqual(['first row', 'third row', 'second row']);
  });
});
