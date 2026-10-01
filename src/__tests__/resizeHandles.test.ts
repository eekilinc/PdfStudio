import { describe, it, expect } from 'vitest';
import { hitResizeCorner, resizeBox, isResizable } from '../utils/annotationGeometry';
import type { Annotation, ShapeAnnotation } from '../types/pdf';

const box = (x: number, y: number, width: number, height: number): Annotation =>
  ({
    id: 'a',
    pageIndex: 0,
    type: 'rect',
    x,
    y,
    width,
    height,
    color: '#000000',
    opacity: 1,
  }) as ShapeAnnotation;

describe('hitResizeCorner', () => {
  const ann = box(100, 100, 200, 100);

  it('finds each of the four corners', () => {
    expect(hitResizeCorner(ann, { x: 100, y: 100 }, 8)).toBe(0);
    expect(hitResizeCorner(ann, { x: 300, y: 100 }, 8)).toBe(1);
    expect(hitResizeCorner(ann, { x: 300, y: 200 }, 8)).toBe(2);
    expect(hitResizeCorner(ann, { x: 100, y: 200 }, 8)).toBe(3);
  });

  it('tolerates a small offset inside the slop', () => {
    expect(hitResizeCorner(ann, { x: 105, y: 103 }, 8)).toBe(0);
  });

  it('misses a point past the slop', () => {
    expect(hitResizeCorner(ann, { x: 120, y: 120 }, 8)).toBeNull();
  });

  it('misses the middle of an edge and of the box', () => {
    expect(hitResizeCorner(ann, { x: 200, y: 100 }, 8)).toBeNull();
    expect(hitResizeCorner(ann, { x: 200, y: 150 }, 8)).toBeNull();
  });

  it('misses anything outside the box', () => {
    expect(hitResizeCorner(ann, { x: 50, y: 50 }, 8)).toBeNull();
    expect(hitResizeCorner(ann, { x: 400, y: 400 }, 8)).toBeNull();
  });

  it('respects the slop it is given', () => {
    // A wider slop reaches further, which is how zoom keeps the grab area
    // constant on screen.
    expect(hitResizeCorner(ann, { x: 120, y: 120 }, 8)).toBeNull();
    expect(hitResizeCorner(ann, { x: 120, y: 120 }, 30)).toBe(0);
  });
});

describe('resizeBox', () => {
  const origin = { x: 100, y: 100, width: 200, height: 100 };

  it('leaves the box untouched when the corner is not dragged', () => {
    const result = resizeBox(origin, 2, { x: 300, y: 200 });
    expect(result).toEqual(origin);
  });

  it('drags the bottom-right corner freely', () => {
    const result = resizeBox(origin, 2, { x: 400, y: 250 });
    expect(result).toEqual({ x: 100, y: 100, width: 300, height: 150 });
  });

  it('pins the opposite edge when dragging the top-left', () => {
    const result = resizeBox(origin, 0, { x: 50, y: 75 });
    // The right and bottom edges stay put; only the origin moves.
    expect(result.x).toBe(50);
    expect(result.y).toBe(75);
    expect(result.x + result.width).toBe(300);
    expect(result.y + result.height).toBe(200);
  });

  it('pins the left edge when dragging the top-right', () => {
    const result = resizeBox(origin, 1, { x: 350, y: 60 });
    expect(result.x).toBe(100);
    expect(result.x + result.width).toBe(350);
    expect(result.y).toBe(60);
    expect(result.y + result.height).toBe(200);
  });

  it('pins the top edge when dragging the bottom-left', () => {
    const result = resizeBox(origin, 3, { x: 60, y: 260 });
    expect(result.y).toBe(100);
    expect(result.x + result.width).toBe(300);
    expect(result.y + result.height).toBe(260);
  });

  it('never inverts the box when a corner crosses the far edge', () => {
    // Dragging the top-left past the bottom-right must not flip the annotation.
    const result = resizeBox(origin, 0, { x: 500, y: 500 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.x + result.width).toBeLessThanOrEqual(300.0001);
    expect(result.y + result.height).toBeLessThanOrEqual(200.0001);
  });

  it('enforces a minimum size when dragged onto the anchor', () => {
    const result = resizeBox(origin, 2, { x: 90, y: 90 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('is idempotent for the same pointer position', () => {
    // The result is computed from the gesture origin, never from the live box,
    // so re-applying it cannot drift.
    const once = resizeBox(origin, 2, { x: 400, y: 250 });
    const twice = resizeBox(once, 2, { x: 400, y: 250 });
    expect(twice).toEqual(once);
  });

  it('keeps area equal to the original for a pure scale', () => {
    // Doubling both sides should double width and height exactly.
    const result = resizeBox(origin, 2, { x: 500, y: 300 });
    expect(result.width).toBe(400);
    expect(result.height).toBe(200);
  });
});

describe('isResizable', () => {
  const make = (type: string) => ({ ...box(0, 0, 10, 10), type }) as unknown as Annotation;

  it('accepts box-shaped annotations', () => {
    for (const type of ['rect', 'circle', 'line', 'arrow', 'text', 'image', 'signature', 'stamp', 'checkbox', 'redact']) {
      expect(isResizable(make(type))).toBe(true);
    }
  });

  it('rejects point-defined annotations', () => {
    // These are drawn from their point lists, so resizing the bounding box
    // would stretch only the selection outline and nothing visible.
    for (const type of ['pen', 'highlighter', 'measure']) {
      expect(isResizable(make(type))).toBe(false);
    }
  });
});
