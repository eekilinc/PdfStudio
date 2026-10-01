/**
 * Page geometry for rotated pages.
 *
 * Annotation coordinates are stored in *unrotated* page space: PDF points, with
 * the origin at the top-left of the page as it was authored. Keeping them there
 * is what makes rotation free — turning a page must not rewrite every stored
 * coordinate, or a page rotated four times would accumulate rounding drift and
 * annotations would detach from the content they were placed on.
 *
 * Rotation is therefore applied only at draw time, and this module owns the
 * mapping in both directions.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Normalise any rotation into 0, 90, 180 or 270 degrees. */
export function normaliseRotation(rotation: number | undefined): 0 | 90 | 180 | 270 {
  const value = ((Math.round((rotation ?? 0) / 90) * 90) % 360 + 360) % 360;
  return value as 0 | 90 | 180 | 270;
}

/** True when the rotation swaps the page's width and height. */
export function isQuarterTurn(rotation: number | undefined): boolean {
  const r = normaliseRotation(rotation);
  return r === 90 || r === 270;
}

/**
 * The size of the page as displayed.
 *
 * A quarter turn swaps the axes, which is the whole reason a rotated page used
 * to render squashed: the canvas was created at the rotated size and then
 * stretched into a box sized from the unrotated dimensions.
 */
export function displaySize(unrotated: Size, rotation: number | undefined): Size {
  return isQuarterTurn(rotation)
    ? { width: unrotated.height, height: unrotated.width }
    : { width: unrotated.width, height: unrotated.height };
}

/**
 * Map a point from unrotated page space into display space.
 *
 * Rotation is clockwise for positive angles, matching how PDF.js rasterises a
 * rotated page, and happens about the centre of the page. A clockwise quarter
 * turn in screen coordinates (y down) maps an offset `(dx, dy)` to `(-dy, dx)`,
 * which sends the page's top-left corner to the top-right of the wider frame.
 */
export function unrotatedToDisplay(
  point: Point,
  unrotated: Size,
  rotation: number | undefined,
): Point {
  const r = normaliseRotation(rotation);
  if (r === 0) return { x: point.x, y: point.y };

  const display = displaySize(unrotated, r);
  const cx = unrotated.width / 2;
  const cy = unrotated.height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;

  switch (r) {
    case 90:
      return { x: display.width / 2 - dy, y: display.height / 2 + dx };
    case 180:
      return { x: display.width / 2 - dx, y: display.height / 2 - dy };
    case 270:
      return { x: display.width / 2 + dy, y: display.height / 2 - dx };
    default:
      return { x: point.x, y: point.y };
  }
}

/** Inverse of {@link unrotatedToDisplay}. */
export function displayToUnrotated(
  point: Point,
  unrotated: Size,
  rotation: number | undefined,
): Point {
  const r = normaliseRotation(rotation);
  if (r === 0) return { x: point.x, y: point.y };

  const display = displaySize(unrotated, r);
  const dx = point.x - display.width / 2;
  const dy = point.y - display.height / 2;

  switch (r) {
    case 90:
      return { x: unrotated.width / 2 + dy, y: unrotated.height / 2 - dx };
    case 180:
      return { x: unrotated.width / 2 - dx, y: unrotated.height / 2 - dy };
    case 270:
      return { x: unrotated.width / 2 - dy, y: unrotated.height / 2 + dx };
    default:
      return { x: point.x, y: point.y };
  }
}

/** The four corners of an axis-aligned rectangle, in display space. */
export function rectToDisplayCorners(
  rect: { x: number; y: number; width: number; height: number },
  unrotated: Size,
  rotation: number | undefined,
): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((corner) => unrotatedToDisplay(corner, unrotated, rotation));
}
