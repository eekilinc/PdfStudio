/**
 * Laying out extracted PDF text into lines and tables.
 *
 * Extracted text arrives as a flat list of positioned runs. Recovering the
 * reading order — and with it the heading hierarchy and the table structure the
 * Office exporters emit — depends on two things that were previously wrong.
 */

/** A run of text with its position on the page, in PDF point space. */
export interface PositionedRun {
  text: string;
  /** Left edge, PDF points. */
  x: number;
  /** Baseline, PDF points, growing upwards. */
  y: number;
  height: number;
  width: number;
  isBold?: boolean;
}

/**
 * The median of a set of numbers.
 *
 * The line-grouping code called its average a "median" and compared every
 * heading threshold against it. One oversized heading or a large footer skewed
 * the baseline, and with it every heading decision on the page.
 */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  // Even counts take the lower of the two middles rather than their average:
  // a median is a value that actually occurred, which keeps it comparable
  // against a measured font size.
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Order positioned runs the way they are read: top to bottom, then left to right.
 *
 * The previous comparator mixed a coarse Y bucket with an X tie-break —
 * `if (|dy| > 4) return dy; return a.x - b.x` — which is not a valid total order.
 * Non-transitive comparators make the result depend on the engine's sort
 * implementation, so two runs could compare as both "less than" and "greater
 * than" and the engine would emit them in an arbitrary sequence, scrambling
 * lines.
 *
 * Ordering is therefore done in two passes: a total order on Y alone, then a
 * stable sort on X *within* each band. Both comparators are transitive.
 *
 * @param runs   The runs to order; not modified.
 * @param tolerance Vertical slack in points for runs on the same line. Derived
 *   from the run height when not given, since a tall run legitimately spans more
 *   than a few points of baseline drift.
 */
export function orderTextRuns(
  runs: PositionedRun[],
  tolerance?: number,
): PositionedRun[] {
  if (runs.length === 0) return [];

  // Pass one: top to bottom only. Stable, so equal baselines keep their input
  // order until the second pass.
  const byRow = [...runs].sort((a, b) => b.y - a.y);

  // Pass two: left to right within each band of near-equal baselines.
  const result: PositionedRun[] = [];
  let band: PositionedRun[] = [];

  const flush = () => {
    if (band.length === 0) return;
    // A stable sort keeps the band in reading order for runs sharing an X.
    const byColumn = [...band].sort((a, b) => a.x - b.x);
    result.push(...byColumn);
    band = [];
  };

  for (const run of byRow) {
    if (band.length === 0) {
      band.push(run);
      continue;
    }
    const bandY = band[0]!.y;
    const slack = tolerance ?? Math.max(4, Math.min(run.height * 0.45, 8));
    if (Math.abs(bandY - run.y) <= slack) {
      band.push(run);
    } else {
      flush();
      band.push(run);
    }
  }
  flush();

  return result;
}

/** A line of runs that share a baseline. */
export interface TextLine {
  /** Representative baseline for the line. */
  y: number;
  runs: PositionedRun[];
  /** Tallest run on the line, which sets the line's box. */
  maxHeight: number;
  /** Left-to-right reading order. */
  ordered: PositionedRun[];
  /** The line's text with runs joined. */
  text: string;
}

/**
 * Group ordered runs into lines by baseline proximity.
 */
export function groupIntoLines(runs: PositionedRun[]): TextLine[] {
  const ordered = orderTextRuns(runs);
  const lines: TextLine[] = [];
  let current: TextLine | null = null;

  for (const run of ordered) {
    if (!current) {
      current = {
        y: run.y,
        runs: [run],
        maxHeight: run.height,
        ordered: [run],
        text: run.text,
      };
      continue;
    }

    const slack = Math.max(4, Math.min(run.height * 0.45, 8));
    if (Math.abs(current.y - run.y) <= slack) {
      current.runs.push(run);
      current.maxHeight = Math.max(current.maxHeight, run.height);
      current.ordered.push(run);
      current.text = `${current.text} ${run.text}`.trim();
    } else {
      lines.push(current);
      current = {
        y: run.y,
        runs: [run],
        maxHeight: run.height,
        ordered: [run],
        text: run.text,
      };
    }
  }

  if (current) lines.push(current);
  return lines;
}
