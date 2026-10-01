import type { Annotation, Point } from '../types/pdf';

/**
 * Resize handles for a selected annotation.
 *
 * The viewer drew four corner handles for the selected annotation but had no
 * hit-testing or geometry behind them, so dragging one did nothing while
 * looking like it should. These helpers are the missing half, kept free of
 * React and canvas so the geometry can be tested directly.
 */

/** Corner indices, clockwise from the top-left, matching {@link RESIZE_CORNERS}. */
export type ResizeCorner = 0 | 1 | 2 | 3;

/** Corner positions within an annotation's box, as 0/1 fractions. */
export const RESIZE_CORNERS: ReadonlyArray<{ fx: number; fy: number }> = [
  { fx: 0, fy: 0 },
  { fx: 1, fy: 0 },
  { fx: 1, fy: 1 },
  { fx: 0, fy: 1 },
];

/** Pointer slop around a corner, in screen pixels, before it counts as a grab. */
export const RESIZE_HIT_SLOP_PX = 8;

/** Smallest box a resize may leave behind, in PDF points. */
export const MIN_ANNOTATION_SIZE = 4;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Annotation types whose box means something.
 *
 * Freehand strokes and measurements are defined by their point lists, so
 * resizing their bounding box would stretch nothing but the selection outline.
 */
export function isResizable(ann: Annotation): boolean {
  return ann.type !== 'pen' && ann.type !== 'highlighter' && ann.type !== 'measure';
}

/**
 * Which corner of `ann` sits under `pt`, or null.
 *
 * `slop` is given in PDF points; the caller converts from pixels by dividing by
 * the zoom, so the grab area stays physically constant at any magnification.
 */
export function hitResizeCorner(ann: Annotation, pt: Point, slop: number): ResizeCorner | null {
  for (let i = 0; i < RESIZE_CORNERS.length; i += 1) {
    const corner = RESIZE_CORNERS[i]!;
    const cx = ann.x + ann.width * corner.fx;
    const cy = ann.y + ann.height * corner.fy;
    if (Math.abs(pt.x - cx) <= slop && Math.abs(pt.y - cy) <= slop) {
      return i as ResizeCorner;
    }
  }
  return null;
}

/**
 * The box a corner drag produces.
 *
 * Computed from the box captured at gesture start, never from the live box, so a
 * long drag cannot accumulate rounding. The opposite edge stays pinned and the
 * minimum size is enforced, which is what stops a corner crossing the far edge
 * and flipping the annotation inside out.
 */
export function resizeBox(origin: Box, corner: ResizeCorner, pt: Point): Box {
  const anchor = RESIZE_CORNERS[corner]!;
  const dragsLeft = anchor.fx === 0;
  const dragsTop = anchor.fy === 0;

  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  if (dragsLeft && dragsTop) {
    const x = Math.min(pt.x, right - MIN_ANNOTATION_SIZE);
    const y = Math.min(pt.y, bottom - MIN_ANNOTATION_SIZE);
    return { x, y, width: right - x, height: bottom - y };
  }

  if (!dragsLeft && dragsTop) {
    const y = Math.min(pt.y, bottom - MIN_ANNOTATION_SIZE);
    const x = origin.x;
    return { x, y, width: Math.max(MIN_ANNOTATION_SIZE, Math.max(pt.x, x) - x), height: bottom - y };
  }

  if (dragsLeft && !dragsTop) {
    const x = Math.min(pt.x, right - MIN_ANNOTATION_SIZE);
    const y = origin.y;
    return { x, y, width: right - x, height: Math.max(MIN_ANNOTATION_SIZE, Math.max(pt.y, y) - y) };
  }

  // Bottom-right: both edges simply follow the pointer.
  const x = origin.x;
  const y = origin.y;
  return {
    x,
    y,
    width: Math.max(MIN_ANNOTATION_SIZE, Math.max(pt.x, x) - x),
    height: Math.max(MIN_ANNOTATION_SIZE, Math.max(pt.y, y) - y),
  };
}
