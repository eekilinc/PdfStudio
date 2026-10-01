import { describe, it, expect } from 'vitest';
import { medianOf, orderTextRuns, groupIntoLines, type PositionedRun } from '../utils/textLayout';

const run = (x: number, y: number, text = 'x', height = 10): PositionedRun => ({
  text,
  x,
  y,
  height,
  width: 10,
});

describe('medianOf', () => {
  it('is unaffected by a single extreme value', () => {
    // The mean moved by more than double here, which is what made one large
    // heading reclassify every other heading on the page.
    expect(medianOf([10, 10, 10, 10, 10])).toBe(10);
    expect(medianOf([10, 10, 10, 10, 1000])).toBe(10);
  });

  it('finds the middle of an odd count', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
  });

  it('averages the two middles of an even count', () => {
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns zero for an empty set', () => {
    expect(medianOf([])).toBe(0);
  });

  it('does not modify its input', () => {
    const values = [5, 1, 3];
    medianOf(values);
    expect(values).toEqual([5, 1, 3]);
  });

  it('handles a single value', () => {
    expect(medianOf([42])).toBe(42);
  });
});

describe('orderTextRuns', () => {
  it('returns an empty list unchanged', () => {
    expect(orderTextRuns([])).toEqual([]);
  });

  it('orders top to bottom', () => {
    const ordered = orderTextRuns([run(0, 100, 'low'), run(0, 300, 'high')]);
    expect(ordered.map((r) => r.text)).toEqual(['high', 'low']);
  });

  it('orders left to right within a line', () => {
    const ordered = orderTextRuns([run(200, 100, 'third'), run(0, 100, 'first'), run(100, 100, 'second')]);
    expect(ordered.map((r) => r.text)).toEqual(['first', 'second', 'third']);
  });

  it('produces a consistent total order', () => {
    // The old comparator was non-transitive: with a Y bucket and an X
    // tie-break, two runs could compare as both less and greater, leaving the
    // output up to the engine's sort implementation.
    const runs = [
      run(0, 100, 'a'),
      run(50, 103, 'b'),
      run(10, 107, 'c'),
      run(90, 101, 'd'),
      run(30, 250, 'e'),
    ];

    const pos = new Map(runs.map((r) => [r.text, orderTextRuns(runs).findIndex((o) => o === r)]));
    for (const a of runs) {
      for (const b of runs) {
        if (a === b) continue;
        const cmp = orderTextRuns([a, b]).map((r) => r.text).join();
        // Comparing the pair in either order must give a stable answer.
        const reverse = orderTextRuns([b, a]).map((r) => r.text).join();
        expect(cmp).toBe(reverse);
        expect(pos.get(a.text)).toBeGreaterThanOrEqual(0);
        expect(pos.get(b.text)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is stable for runs sharing a position', () => {
    const a = run(0, 100, 'a');
    const b = run(0, 100, 'b');
    const ordered = orderTextRuns([a, b]);
    expect(ordered.map((r) => r.text)).toEqual(['a', 'b']);
  });

  it('does not modify its input', () => {
    const runs = [run(0, 100, 'low'), run(0, 300, 'high')];
    const snapshot = [...runs];
    orderTextRuns(runs);
    expect(runs).toEqual(snapshot);
  });

  it('groups runs whose baselines drift within the tolerance', () => {
    // Real PDFs drift a few points between runs on one line.
    const ordered = orderTextRuns([run(0, 100, 'a'), run(50, 102, 'b')]);
    expect(ordered.map((r) => r.text)).toEqual(['a', 'b']);
  });
});

describe('groupIntoLines', () => {
  it('joins runs sharing a baseline into one line', () => {
    const lines = groupIntoLines([run(0, 100, 'hello'), run(60, 100, 'world')]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('hello world');
  });

  it('separates lines with distinct baselines, topmost first', () => {
    // PDF Y grows upwards, so the larger baseline is the line higher on the page.
    const lines = groupIntoLines([run(0, 100, 'lower'), run(0, 140, 'upper')]);
    expect(lines.map((l) => l.text)).toEqual(['upper', 'lower']);
  });

  it('reports the tallest run as the line height', () => {
    const lines = groupIntoLines([run(0, 100, 'a', 8), run(60, 101, 'b', 20)]);
    expect(lines[0]!.maxHeight).toBe(20);
  });

  it('keeps each line internally left to right', () => {
    const lines = groupIntoLines([
      run(200, 100, 'c'),
      run(0, 100, 'a'),
      run(100, 100, 'b'),
    ]);
    expect(lines[0]!.ordered.map((r) => r.text)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for no input', () => {
    expect(groupIntoLines([])).toEqual([]);
  });
});
