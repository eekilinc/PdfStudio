/**
 * Font metadata inference for the invisible selectable text layer.
 *
 * PDF.js hands us a font *name*, not a style record, so the style has to be
 * read back out of the string. Names arrive in several conventions:
 *
 *   `ABCDEF+Calibri`        subset-prefixed, plain
 *   `Arial-BoldMT`          style suffix plus Mac "MT" marker
 *   `LiberationSans-BoldItalic`
 *   `Helvetica-Oblique`     base-14 face name
 *   `cmbx10` / `cmti10`     TeX encoding: bx = bold, ti = math italic
 *   `g_d0_f1`               unnamed glyph run, no style information at all
 *
 * The previous implementation tested for the *letter* `i` and `b` anywhere in
 * the name, which marked Arial, Helvetica, Calibri, Times New Roman and every
 * other name containing those letters as italic or bold. Matching has to be on
 * style tokens delimited by the name, never on bare characters.
 */

/** Style a text run should be rendered with in the DOM text layer. */
export interface InferredFontStyle {
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
}

const DEFAULT_FONT: InferredFontStyle = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
};

/**
 * Ordered family table. First match wins, so the specific names are tested
 * before the generic `serif` / `sans` buckets they would otherwise fall into.
 */
const FAMILIES: ReadonlyArray<{ test: RegExp; family: string }> = [
  { test: /courier|mono|consolas|typewriter|menlo|jetbrains/i, family: '"JetBrains Mono", Consolas, monospace' },
  { test: /times|liberationserif|cambria|georgia|garamond|minion|palatino|bookman|serif|roman/i, family: 'Georgia, "Times New Roman", serif' },
  { test: /roboto/i, family: 'Roboto, sans-serif' },
  { test: /arial|helvetica|liberationsans|verdana|tahoma|calibri|segoe|noto|sans/i, family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
];

/** Words that mark a face as bold once the name is tokenised. */
const BOLD_WORDS = new Set([
  'bold',
  'black',
  'heavy',
  'extrabold',
  'ultrabold',
  'semibold',
  'demibold',
]);

/** Words that mark a face as italic. */
const ITALIC_WORDS = new Set(['italic', 'italique', 'oblique']);

/** TeX Computer Modern encodings, which carry no delimiters: cmbx10, cmti10. */
const TEX_BOLD = /^cm(bx|b|bssy)\d*$/;
const TEX_ITALIC = /^cm(ti|mi|sl)\d*$/;

/** Strip the `ABCDEF+` subset prefix that appears on embedded subset fonts. */
function stripSubsetPrefix(name: string): string {
  const match = /^[A-Z]{6}\+(.*)$/.exec(name);
  return match?.[1] ?? name;
}

/**
 * Split a font name into lowercase words.
 *
 * Delimiters are removed and a boundary is inserted at every lower-to-upper
 * transition, so the Office compound suffixes come apart: `Arial-BoldItalicMT`
 * yields arial, bold, italic, mt instead of one opaque token. Without that split
 * neither bold nor italic is detectable in the compound forms, which is the
 * majority of what modern Office PDFs embed. Comparing whole words is also what
 * keeps `Blackadder` from being read as `black`.
 */
function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Classify a PDF font name into a family and weight/style.
 *
 * An unnamed glyph run (`g_d0_f1`) carries no style information, so it falls
 * back to the UI font rather than being guessed at — a wrong guess would render
 * the text layer in a mismatched serif and misalign the selection rectangles.
 */
export function inferFontStyle(rawName?: string | null): InferredFontStyle {
  if (!rawName) return DEFAULT_FONT;

  const name = stripSubsetPrefix(rawName).trim();
  if (!name || /^g_\w+_f\d+$/i.test(name)) return DEFAULT_FONT;

  const words = tokenize(name);
  const isBold = words.some((w) => BOLD_WORDS.has(w)) || TEX_BOLD.test(words.join(''));
  const isItalic = words.some((w) => ITALIC_WORDS.has(w)) || TEX_ITALIC.test(words.join(''));

  const family = FAMILIES.find((entry) => entry.test.test(name))?.family ?? DEFAULT_FONT.fontFamily;

  return {
    fontFamily: family,
    fontWeight: isBold ? 'bold' : 'normal',
    fontStyle: isItalic ? 'italic' : 'normal',
  };
}
