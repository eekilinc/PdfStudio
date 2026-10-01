import { describe, it, expect } from 'vitest';
import {
  displaySize,
  displayToUnrotated,
  unrotatedToDisplay,
  isQuarterTurn,
  normaliseRotation,
  rectToDisplayCorners,
  type Size,
} from '../utils/pageGeometry';

/** A4 portrait: tall and narrow. */
const A4: Size = { width: 595.28, height: 841.89 };

describe('normaliseRotation', () => {
  it('snaps to the four quarter turns', () => {
    expect(normaliseRotation(0)).toBe(0);
    expect(normaliseRotation(90)).toBe(90);
    expect(normaliseRotation(180)).toBe(180);
    expect(normaliseRotation(270)).toBe(270);
    expect(normaliseRotation(360)).toBe(0);
    expect(normaliseRotation(450)).toBe(90);
  });

  it('handles negative and missing input', () => {
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(undefined)).toBe(0);
  });

  it('rounds near-quarter values', () => {
    expect(normaliseRotation(89)).toBe(90);
    expect(normaliseRotation(1)).toBe(0);
  });
});

describe('isQuarterTurn', () => {
  it('is true only for the axis-swapping rotations', () => {
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(270)).toBe(true);
    expect(isQuarterTurn(0)).toBe(false);
    expect(isQuarterTurn(180)).toBe(false);
  });
});

describe('displaySize', () => {
  it('is unchanged at 0 and 180 degrees', () => {
    expect(displaySize(A4, 0)).toEqual(A4);
    expect(displaySize(A4, 180)).toEqual(A4);
  });

  it('swaps the axes at 90 and 270 degrees', () => {
    // This is the bug: the canvas was created at the rotated size and then
    // stretched into a box sized from the unrotated dimensions.
    expect(displaySize(A4, 90)).toEqual({ width: A4.height, height: A4.width });
    expect(displaySize(A4, 270)).toEqual({ width: A4.height, height: A4.width });
  });
});

describe('unrotatedToDisplay and its inverse', () => {
  const corners = [
    { x: 0, y: 0 },
    { x: A4.width, y: 0 },
    { x: 0, y: A4.height },
    { x: A4.width, y: A4.height },
    { x: A4.width / 2, y: A4.height / 2 },
  ];

  for (const rotation of [0, 90, 180, 270]) {
    it(`round-trips every corner at ${rotation} degrees`, () => {
      for (const corner of corners) {
        const there = unrotatedToDisplay(corner, A4, rotation);
        const back = displayToUnrotated(there, A4, rotation);
        expect(back.x).toBeCloseTo(corner.x, 6);
        expect(back.y).toBeCloseTo(corner.y, 6);
      }
    });
  }

  it('keeps the page centre at the centre of the displayed box', () => {
    // The unrotated centre and the display centre are different points once the
    // axes swap, so the assertion is against the display box's own centre.
    const centre = { x: A4.width / 2, y: A4.height / 2 };
    for (const rotation of [0, 90, 180, 270]) {
      const box = displaySize(A4, rotation);
      const mapped = unrotatedToDisplay(centre, A4, rotation);
      expect(mapped.x).toBeCloseTo(box.width / 2, 6);
      expect(mapped.y).toBeCloseTo(box.height / 2, 6);
    }
  });

  it('lands every corner inside the displayed box', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const box = displaySize(A4, rotation);
      for (const corner of corners) {
        const p = unrotatedToDisplay(corner, A4, rotation);
        expect(p.x).toBeGreaterThanOrEqual(-0.001);
        expect(p.x).toBeLessThanOrEqual(box.width + 0.001);
        expect(p.y).toBeGreaterThanOrEqual(-0.001);
        expect(p.y).toBeLessThanOrEqual(box.height + 0.001);
      }
    }
  });

  it('turns the top-left corner to the top-right at 90 degrees', () => {
    // A clockwise quarter turn sends the page's top-left to the top-right.
    const p = unrotatedToDisplay({ x: 0, y: 0 }, A4, 90);
    expect(p.x).toBeCloseTo(A4.height, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('is the identity at 0 degrees', () => {
    const p = unrotatedToDisplay({ x: 12, y: 34 }, A4, 0);
    expect(p).toEqual({ x: 12, y: 34 });
  });
});

describe('rectToDisplayCorners', () => {
  it('returns the four corners in order', () => {
    const corners = rectToDisplayCorners({ x: 10, y: 20, width: 100, height: 50 }, A4, 0);
    expect(corners).toHaveLength(4);
    expect(corners[0]).toEqual({ x: 10, y: 20 });
    expect(corners[2]).toEqual({ x: 110, y: 70 });
  });

  it('produces a box with the same area as the original', () => {
    // A rotation must not scale anything; only reorient.
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    for (const rotation of [0, 90, 180, 270]) {
      const corners = rectToDisplayCorners(rect, A4, rotation);
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      expect(w * h).toBeCloseTo(rect.width * rect.height, 4);
    }
  });

  it('swaps width and height for a quarter turn', () => {
    const corners = rectToDisplayCorners({ x: 0, y: 0, width: 100, height: 50 }, A4, 90);
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50, 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 4);
  });
});
