/**
 * Annotation identifiers.
 *
 * Two problems motivated this over inline `Math.random()` calls:
 *
 * 1. React's purity lint treats an impure call anywhere in a component body as
 *    a render-phase side effect, even when the call only runs from an event
 *    handler. That was five warnings across the viewer.
 * 2. `Math.random().toString(36).substring(2, 9)` has real collision risk, and
 *    deriving a second annotation's id from an existing one (`'edit-' + item.id`)
 *    produced *identical* ids whenever the same text run was edited twice. The
 *    second annotation then updated on delete but was not the one hit-tested,
 *    so it could not be selected or erased.
 *
 * A monotonic counter is collision-free within a session and needs no
 * randomness at all.
 */

let counter = 0;

/**
 * A unique id for a newly created annotation.
 *
 * @param prefix Distinguishes the origin, which makes ids readable in a
 *   debugger and in exported diagnostics: `text-3`, `sig-4`, `redact-5`.
 */
export function nextAnnotationId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

/** Test seam: resets the counter so ids are predictable across test cases. */
export function __resetAnnotationIdCounter(): void {
  counter = 0;
}
