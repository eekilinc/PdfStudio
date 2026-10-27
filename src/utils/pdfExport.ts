import {
  PDFDocument,
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFObject,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFString,
  PDFTextField,
  ColorTypes,
  rgb,
  degrees,
  StandardFonts,
  PDFPage,
  LineCapStyle,
} from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { applyRedactions, collectRedactions, type RedactionQuality } from './redaction';
import { APP_NAME, APP_VERSION } from '../version';
import { COMMENT_SUBTYPE_BY_KIND, isCommentSubtype } from './pdfInspect';
import {
  writeDocumentId,
  writePdfAMetadata,
  type PdfaTarget,
} from './pdfa';
import {
  setDisplayDocTitle,
  setDocumentLanguage,
  setDocumentTitle,
  setFieldDescriptions,
  tagDocument,
} from './a11y';
import type {
  AccessibilityState,
  Annotation,
  FormFieldValue,
  PageBoxSettings,
  PageLabelRange,
  PageTransition,
  PDFDocumentState,
  PdfBookmark,
  PdfComment,
  PdfLink,
  SanitizeOptions,
  TextAnnotation,
  DrawingAnnotation,
  ShapeAnnotation,
  SignatureAnnotation,
  StampAnnotation,
} from '../types/pdf';

/**
 * Fold a string to the WinAnsi range used by the PDF standard-14 fonts.
 *
 * WinAnsiEncoding is CP1252-shaped: slots 0xA0-0xFF follow Latin-1, so the
 * Turkish letters that Latin-1 contains — ç Ç ö Ö ü Ü — are already encodable
 * and are left alone. Folding them to ASCII, as this function used to, needlessly
 * corrupted Turkish words in the exported document's own text layer.
 *
 * The remaining Turkish letters have no WinAnsi slot at all: ğ Ğ ş Ş ı İ live
 * above U+00FF and cannot be represented, so they are transliterated to their
 * nearest ASCII rather than dropped, which would leave holes mid-word.
 */
export function toWinAnsi(str: string): string {
  if (!str) return '';
  return (
    str
      // Typographic punctuation with a direct WinAnsi equivalent. These are
      // ASCII stand-ins because pdf-lib's WinAnsi encoder has no glyph slot for
      // the curly variants; dropping them would run words together.
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/\u0192/g, 'f')
      .replace(/[\u2039\u203A]/g, ' ')
      .replace(/\u2030/g, '%')
      .replace(/[\u02C6\u02DC]/g, '~')
      .replace(/[\u02DD\u02DB]/g, '"')
      .replace(/\u02DA/g, 'o')
      .replace(/[\u2020\u2021]/g, '+')
      .replace(/\u0152/g, 'OE')
      .replace(/\u0153/g, 'oe')
      .replace(/\u0160/g, 'S')
      .replace(/\u017D/g, 'Z')
      .replace(/\u017E/g, 'z')
      .replace(/\u0178/g, 'Y')
      // Turkish letters with no WinAnsi slot. Latin-1 covers ç Ç ö Ö ü Ü, which
      // are left alone above; these four pairs sit above U+00FF and simply are
      // not representable in the standard-14 fonts. Each pattern is
      // case-preserving so the leading capital of a word survives.
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      // Anything still outside the encodable set is removed rather than
      // substituted, since a wrong glyph would misrepresent the text.
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
  );
}

/**
 * Carry the source document's metadata across.
 *
 * The exporter builds a fresh document and copies pages, so without this every
 * save dropped the title, author, subject, keywords and producer. Those are the
 * fields a reader sees in their file properties, and a document that had been
 * catalogued would silently lose its catalogue record on the first Ctrl+S.
 *
 * `setProducer` and `setCreator` are intentionally *not* copied: they identify
 * the tool, and the output really was produced by this application. The creation
 * date is left for pdf-lib to stamp, since a round trip should reflect when the
 * file was last written.
 */
function copyDocumentInfo(srcDoc: PDFDocument, outDoc: PDFDocument): void {
  const copyString = (read: () => string | undefined, write: (value: string) => void) => {
    try {
      const value = read();
      if (value) write(value);
    } catch {
      // A malformed /Info entry must not abort the save.
    }
  };

  copyString(() => srcDoc.getTitle(), (v) => outDoc.setTitle(v));
  copyString(() => srcDoc.getAuthor(), (v) => outDoc.setAuthor(v));
  copyString(() => srcDoc.getSubject(), (v) => outDoc.setSubject(v));
  copyString(() => srcDoc.getKeywords(), (v) => outDoc.setKeywords([v]));

  outDoc.setProducer(`${APP_NAME} ${APP_VERSION}`);
  outDoc.setCreator(srcDoc.getCreator() ?? APP_NAME);

  // Only the creation date is carried over. pdf-lib refreshes the modification
  // date on every save, which is correct: the file *was* just modified.
  try {
    const created = srcDoc.getCreationDate();
    if (created) outDoc.setCreationDate(created);
  } catch {
    // Ignore a missing or unparsable date.
  }
}

/**
 * Rebuild the source document's bookmark tree in the output.
 *
 * The tree is walked from the raw outline dictionary rather than through a
 * higher-level API because destinations must be re-pointed: the source refers to
 * its own page objects, and after reordering, deletion or a redaction raster
 * those objects are not the pages in the output any more. `outlineRemap` maps an
 * output page back to the source page number it was copied from, which is the
 * only stable identity available across the copy.
 */
async function copyOutlines(
  srcDoc: PDFDocument,
  outDoc: PDFDocument,
  outlineRemap: Map<PDFRef, number>,
): Promise<void> {
  if (outlineRemap.size === 0) return;

  try {
    // `lookup` throws when the key is absent, and `get` returns the raw entry,
    // which for a cross-reference is a PDFRef rather than the dictionary.
    const raw = srcDoc.catalog.get(PDFName.of('Outlines'));
    if (raw === undefined) return;
    const srcRoot = raw instanceof PDFRef ? srcDoc.context.lookup(raw) : raw;
    if (!(srcRoot instanceof PDFDict)) return;

    // Source page number -> the page in the output that came from it.
    const outputPageBySource = new Map<number, PDFPage>();
    for (const [ref, sourceNumber] of outlineRemap) {
      const page = outDoc.getPages().find((p) => p.ref === ref);
      if (page) outputPageBySource.set(sourceNumber, page);
    }
    if (outputPageBySource.size === 0) return;

    /**
     * Source page number keyed by the page's dictionary.
     *
     * Matching is on the dictionary rather than by searching the page list for
     * the destination's first element, because that element is a reference, not
     * a `PDFPage` instance.
     */
    const sourceNumberByDict = new Map<PDFDict, number>();
    srcDoc.getPages().forEach((page, i) => {
      sourceNumberByDict.set(page.node as unknown as PDFDict, i + 1);
    });

    /** Destination inside the source document, resolved to an output page. */
    const resolveDestination = (node: PDFDict): { page: PDFPage; top: number } | null => {
      const dest = node.get(PDFName.of('Dest'));
      if (!dest) return null;

      let array: unknown[] | null = null;
      if (dest instanceof PDFArray) {
        array = dest.asArray();
      } else if (dest instanceof PDFDict) {
        // A named destination: /D holds the real array.
        const named = dest.get(PDFName.of('D'));
        if (named instanceof PDFArray) array = named.asArray();
      }
      if (!array || array.length === 0) return null;

      const target = array[0];
      if (target === undefined) return null;
      // A parsed document keeps indirect entries as references; a destination
      // built in memory may hold the dictionary directly. Handle both.
      const targetDict = target instanceof PDFRef ? srcDoc.context.lookup(target) : target;
      if (!(targetDict instanceof PDFDict)) return null;

      const sourceNumber = sourceNumberByDict.get(targetDict);
      const page = sourceNumber !== undefined ? outputPageBySource.get(sourceNumber) : undefined;
      if (!page) return null;

      // The vertical offset is optional; PDFNull means "top of the page".
      const rawTop = array[1];
      const top = rawTop instanceof PDFNumber ? rawTop.asNumber() : 0;
      return { page, top };
    };

    const textOf = (node: PDFDict): string => {
      const title = node.get(PDFName.of('Title'));
      if (title instanceof PDFHexString) {
        // PDFHexString decodes UTF-16BE, which is how non-Latin titles are stored.
        try {
          return title.decodeText();
        } catch {
          return title.asString();
        }
      }
      if (title instanceof PDFName) return title.decodeText();
      if (title instanceof PDFString) return title.decodeText();
      return '';
    };

    /** Resolve a key on `node` to a dictionary, or null if it is absent. */
    const dictAt = (node: PDFDict, key: string): PDFDict | null => {
      const raw = node.get(PDFName.of(key));
      if (raw === undefined) return null;
      const resolved = raw instanceof PDFRef ? srcDoc.context.lookup(raw) : raw;
      return resolved instanceof PDFDict ? resolved : null;
    };

    const childrenOf = (node: PDFDict): PDFDict[] => {
      const children: PDFDict[] = [];
      let cursor = dictAt(node, 'First');
      // The sibling list is a linked list; the bound guards against a cycle in
      // a malformed file rather than trusting the input.
      while (cursor && children.length < 10_000) {
        children.push(cursor);
        cursor = dictAt(cursor, 'Next');
      }
      return children;
    };

    let created = 0;

    // An outline item is a plain dictionary; pdf-lib exposes no builder, and a
    // bare object carries no reference until the context registers it, so each
    // item is registered here and the sibling links are wired by hand.
    const copyLevel = (nodes: PDFDict[], parentRef?: PDFRef): PDFRef[] => {
      const built: Array<{ dict: PDFDict; ref: PDFRef }> = [];
      for (const node of nodes) {
        const title = textOf(node);
        if (!title) continue;

        const outline = outDoc.context.obj({ Title: PDFHexString.fromText(title) });
        const outlineRef = outDoc.context.register(outline);
        created += 1;

        const resolved = resolveDestination(node);
        if (resolved) {
          outline.set(
            PDFName.of('Dest'),
            outDoc.context.obj([
              resolved.page.ref,
              PDFName.of('XYZ'),
              PDFNull,
              PDFNumber.of(resolved.top),
              PDFNull,
            ]),
          );
        }

        if (parentRef) outline.set(PDFName.of('Parent'), parentRef);
        built.push({ dict: outline, ref: outlineRef });

        const children = childrenOf(node);
        if (children.length > 0) {
          const builtChildren = copyLevel(children, outlineRef);
          if (builtChildren.length > 0) {
            outline.set(PDFName.of('First'), builtChildren[0]!);
            outline.set(PDFName.of('Last'), builtChildren[builtChildren.length - 1]!);
            outline.set(PDFName.of('Count'), PDFNumber.of(builtChildren.length));
          }
        }
      }

      // Siblings are a /Next chain. Without it only the first bookmark of each
      // level would be reachable, and the rest would silently vanish.
      for (let i = 0; i < built.length - 1; i += 1) {
        built[i]!.dict.set(PDFName.of('Next'), built[i + 1]!.ref);
      }

      return built.map((b) => b.ref);
    };

    const roots = childrenOf(srcRoot);
    if (roots.length === 0) return;

    const top = copyLevel(roots);
    if (top.length > 0 && created > 0) {
      const root = outDoc.context.obj({ Type: PDFName.of('Outlines') });
      const rootRef = outDoc.context.register(root);
      root.set(PDFName.of('First'), top[0]!);
      root.set(PDFName.of('Last'), top[top.length - 1]!);
      root.set(PDFName.of('Count'), PDFNumber.of(top.length));
      outDoc.catalog.set(PDFName.of('Outlines'), rootRef);
    }
  } catch (err) {
    // Losing bookmarks is a real loss, so it is reported, but it must not stop
    // the document from being written.
    console.warn('Bookmarks could not be carried over:', err);
  }
}

/**
 * Resolve a family + weight pair to one of the four embedded standard fonts.
 *
 * The weight has to be decided *inside* the family branches. Checking weight
 * first and family second let the family test overwrite it, so a bold
 * "Times New Roman" annotation exported as regular Times.
 */
/** The six standard-14 faces the exporter embeds. */
interface ExportFonts {
  Helvetica: PDFFont;
  HelveticaBold: PDFFont;
  Times: PDFFont;
  TimesBold: PDFFont;
  Courier: PDFFont;
  CourierBold: PDFFont;
}

function pickFont(
  fontFamily: string | undefined,
  fontWeight: string | undefined,
  fonts: ExportFonts,
): PDFFont {
  const isBold = fontWeight === 'bold';
  const family = (fontFamily ?? '').toLowerCase();

  if (family.includes('times') || family.includes('serif') || family.includes('georgia') || family.includes('garamond')) {
    return isBold ? fonts.TimesBold : fonts.Times;
  }
  if (family.includes('courier') || family.includes('mono') || family.includes('consolas')) {
    return isBold ? fonts.CourierBold : fonts.Courier;
  }
  // Helvetica is the fallback: only the standard-14 faces are embedded, so an
  // arbitrary family name cannot be honoured and must not crash the export.
  return isBold ? fonts.HelveticaBold : fonts.Helvetica;
}

// Parse hex color string '#RRGGBB' to pdf-lib rgb(r, g, b)
export function hexToRgb(hex: string) {
  if (!hex || hex === 'transparent') return null;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return rgb(0, 0, 0);
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Resolve a PDF object that may be stored indirectly.
 */
function resolveObject(doc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? doc.context.lookup(value) : value;
}

/**
 * The /Subtype of an annotation, without its leading slash.
 */
function annotationSubtype(doc: PDFDocument, dict: PDFDict): string {
  const raw = resolveObject(doc, dict.get(PDFName.of('Subtype')));
  if (!(raw instanceof PDFName)) return '';
  return raw.asString().replace(/^\//, '');
}

/**
 * Build the annotation dictionary of one review comment.
 *
 * The dictionary follows the PDF specification for review annotations:
 * a note carries the icon name and stays out of the zoom and rotate
 * controls, a text markup carries its quad points, and both carry the
 * author, the date and the identifier the panel uses to thread replies.
 */
function buildCommentDict(
  doc: PDFDocument,
  page: PDFPage,
  comment: PdfComment,
  pageHeight: number,
): PDFDict {
  const dict = doc.context.obj({});
  dict.set(PDFName.of('Type'), PDFName.of('Annot'));
  dict.set(PDFName.of('Subtype'), PDFName.of(COMMENT_SUBTYPE_BY_KIND[comment.kind]));

  // Comments are stored in the app's own page space, where the origin is the
  // top left of the page; a PDF rectangle is measured from the bottom left.
  const x0 = comment.rect.x;
  const width = comment.rect.width;
  const height = comment.rect.height;
  const y0 = pageHeight - comment.rect.y - height;
  dict.set(PDFName.of('Rect'), doc.context.obj([x0, y0, x0 + width, y0 + height]));

  if (comment.contents) {
    dict.set(PDFName.of('Contents'), PDFHexString.fromText(comment.contents));
  }
  if (comment.author) {
    dict.set(PDFName.of('T'), PDFHexString.fromText(comment.author));
  }
  if (comment.modified) {
    dict.set(PDFName.of('M'), PDFString.of(comment.modified));
  }
  dict.set(PDFName.of('NM'), PDFString.of(comment.id));
  dict.set(PDFName.of('P'), page.ref);

  // 4 is "print". A note adds "do not zoom" and "do not rotate" (28), which
  // is what Acrobat writes and what keeps the icon from scaling with a page.
  dict.set(PDFName.of('F'), PDFNumber.of(comment.kind === 'note' ? 28 : 4));

  const color = hexToRgb(comment.color || '');
  if (color && color.type === ColorTypes.RGB) {
    dict.set(PDFName.of('C'), doc.context.obj([color.red, color.green, color.blue]));
  }

  if (comment.kind === 'note') {
    dict.set(PDFName.of('Name'), PDFName.of('Comment'));
    dict.set(PDFName.of('Open'), doc.context.obj(false));
  }

  if (comment.status) {
    dict.set(PDFName.of('State'), PDFName.of(comment.status));
    dict.set(PDFName.of('StateModel'), PDFName.of('Review'));
  }

  if (comment.quads && comment.quads.length >= 8) {
    dict.set(PDFName.of('QuadPoints'), doc.context.obj(comment.quads));
  }

  return dict;
}

/**
 * Write the comments of one page as real PDF annotations.
 *
 * Parents are written before their replies so that a reply can point at a
 * reference that already exists, which is how a thread is expressed in a
 * PDF: the reply names its parent in /IRT.
 */
function writeComments(doc: PDFDocument, page: PDFPage, comments: PdfComment[]): PDFRef[] {
  if (comments.length === 0) return [];

  const pageHeight = page.getHeight();
  const refs = new Map<string, PDFRef>();
  const written: PDFRef[] = [];

  const ordered = [...comments].sort(
    (a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)),
  );

  for (const comment of ordered) {
    const dict = buildCommentDict(doc, page, comment, pageHeight);
    const ref = doc.context.register(dict);
    written.push(ref);
    refs.set(comment.id, ref);
  }

  for (const comment of ordered) {
    if (!comment.parentId) continue;
    const parentRef = refs.get(comment.parentId);
    const ownRef = refs.get(comment.id);
    if (!parentRef || !ownRef) continue;
    const dict = doc.context.lookup(ownRef);
    if (dict instanceof PDFDict) dict.set(PDFName.of('IRT'), parentRef);
  }

  return written;
}

/**
 * Write the hyperlinks of one page as link annotations.
 *
 * A link is either an address that leaves the document, written as a URI
 * action, or a jump inside it, written as a destination that names the
 * page of the *output* document. The border is zero wide, which is what
 * every reader draws as an invisible link area.
 */
function writeLinks(
  doc: PDFDocument,
  page: PDFPage,
  links: PdfLink[],
  pageHeight: number,
  targetPageRef: (sourcePageIndex: number) => PDFRef | undefined,
): PDFRef[] {
  const written: PDFRef[] = [];

  for (const link of links) {
    const dict = doc.context.obj({});
    dict.set(PDFName.of('Type'), PDFName.of('Annot'));
    dict.set(PDFName.of('Subtype'), PDFName.of('Link'));

    const x0 = link.rect.x;
    const y0 = pageHeight - link.rect.y - link.rect.height;
    dict.set(
      PDFName.of('Rect'),
      doc.context.obj([x0, y0, x0 + link.rect.width, y0 + link.rect.height]),
    );

    dict.set(PDFName.of('P'), page.ref);
    dict.set(PDFName.of('F'), PDFNumber.of(4));
    // A zero wide border makes the link area invisible, the way a reader
    // draws it.
    dict.set(PDFName.of('Border'), doc.context.obj([0, 0, 0]));
    dict.set(PDFName.of('NM'), PDFString.of(link.id));

    if (link.kind === 'external' && link.url) {
      dict.set(
        PDFName.of('A'),
        doc.context.obj({ S: PDFName.of('URI'), URI: PDFString.of(link.url) }),
      );
    } else if (link.targetPageIndex !== undefined) {
      const target = targetPageRef(link.targetPageIndex);
      if (target) {
        dict.set(
          PDFName.of('Dest'),
          doc.context.obj([
            target,
            PDFName.of('XYZ'),
            PDFNull,
            link.targetY !== undefined ? PDFNumber.of(link.targetY) : PDFNull,
            PDFNull,
          ]),
        );
      }
    }

    written.push(doc.context.register(dict));
  }

  return written;
}

/**
 * Append annotations to a page that already carries some.
 */
function appendAnnotations(doc: PDFDocument, page: PDFPage, refs: PDFRef[]): void {
  if (refs.length === 0) return;
  const raw = page.node.get(PDFName.of('Annots'));
  const arr = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  if (arr instanceof PDFArray) {
    for (const ref of refs) arr.push(ref);
    return;
  }
  page.node.set(PDFName.of('Annots'), doc.context.obj(refs));
}

/**
 * Rewrite the annotations of an output page.
 *
 * The comments that came with the file are dropped first and written back
 * from the app's own list afterwards. That keeps a single source of truth:
 * a comment the user deleted stays deleted, an edited comment keeps its
 * edit, and a reply added here survives the next save.
 *
 * The document inspector works on the same list, which is why the removal
 * options are honoured here rather than in a second pass over the file.
 */
function rewritePageAnnotations(
  doc: PDFDocument,
  page: PDFPage,
  comments: PdfComment[],
  sanitize?: SanitizeOptions,
  manageLinks = false,
): void {
  const raw = page.node.get(PDFName.of('Annots'));
  const arr = resolveObject(doc, raw);
  const existing: PDFObject[] = arr instanceof PDFArray ? arr.asArray() : [];

  const droppedRefs = new Set<string>();
  const survivors: PDFObject[] = [];

  for (const entry of existing) {
    const dict = resolveObject(doc, entry);
    if (!(dict instanceof PDFDict)) continue;
    const subtype = annotationSubtype(doc, dict);
    if (isCommentSubtype(subtype)) {
      // The comment is written back from the app's list below.
      if (entry instanceof PDFRef) droppedRefs.add(entry.toString());
      continue;
    }
    if (manageLinks && subtype === 'Link') {
      // The link is written back from the app's list as well, so that a link
      // the user removed does not come back from the copied page.
      continue;
    }
    survivors.push(entry);
  }

  // A pop-up belongs to its note, so it leaves with the note.
  const withoutOrphans: PDFObject[] = [];
  for (const entry of survivors) {
    const dict = resolveObject(doc, entry);
    if (dict instanceof PDFDict && annotationSubtype(doc, dict) === 'Popup') {
      const parent = dict.get(PDFName.of('Parent'));
      if (parent instanceof PDFRef && droppedRefs.has(parent.toString())) continue;
    }
    withoutOrphans.push(entry);
  }

  const kept = withoutOrphans.filter((entry) => {
    const dict = resolveObject(doc, entry);
    if (!(dict instanceof PDFDict)) return false;
    const subtype = annotationSubtype(doc, dict);
    if (sanitize?.links && subtype === 'Link') return false;
    if (sanitize?.formFields && subtype === 'Widget') return false;
    return true;
  });

  const next = doc.context.obj(kept);
  if (!sanitize?.comments) {
    for (const ref of writeComments(doc, page, comments)) next.push(ref);
  }
  page.node.set(PDFName.of('Annots'), next);
}

/**
 * Fill the interactive form of the source document.
 *
 * The values are applied to the *source* document, before its pages are
 * copied, so that both the value and the regenerated appearance travel
 * with the page into the output.
 *
 * Returns whether a reader has to redraw the fields itself, which happens
 * when the standard fonts cannot hold the text: the value is still written
 * correctly, but the appearance needs a font the file itself may carry.
 */
async function applyFormValues(
  srcDoc: PDFDocument,
  values: Record<string, FormFieldValue> | undefined,
): Promise<boolean> {
  if (!values) return false;
  const entries = Object.entries(values);
  if (entries.length === 0) return false;

  let form;
  try {
    form = srcDoc.getForm();
  } catch {
    return false;
  }

  let font: PDFFont | undefined;
  let needsAppearances = false;

  for (const [name, value] of entries) {
    try {
      const field = form.getField(name);

      if (field instanceof PDFTextField) {
        field.setText(typeof value === 'string' ? value : '');
        try {
          if (!font) font = await srcDoc.embedFont(StandardFonts.Helvetica);
          field.updateAppearances(font);
        } catch {
          // The text holds letters the standard font cannot draw. The value
          // is correct; only the appearance is missing.
          needsAppearances = true;
        }
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        field.clear();
        if (typeof value === 'string' && value) field.select(value);
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        field.clear();
        if (typeof value === 'string' && value) field.select(value);
      }
    } catch (err) {
      // A field the document does not have, or one the library refuses to
      // touch, must not stop the save.
      console.warn('Form field could not be filled:', name, err);
    }
  }

  return needsAppearances;
}

/**
 * Write the page labels into the catalog.
 *
 * The labels are a number tree: an array of pairs, where the number is the
 * index of the first page of a range and the dictionary beside it says how
 * the pages of that range are numbered. The dictionaries are written as
 * indirect objects, because some readers skip direct ones and fall back to
 * the physical page numbers.
 */
function writePageLabels(doc: PDFDocument, ranges: PageLabelRange[]): void {
  if (ranges.length === 0) return;

  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage);
  const nums: PDFObject[] = [];

  for (const range of sorted) {
    const spec = doc.context.obj({});
    spec.set(PDFName.of('S'), PDFName.of(range.style));
    if (range.first !== 1) spec.set(PDFName.of('St'), PDFNumber.of(range.first));
    if (range.prefix) spec.set(PDFName.of('P'), PDFString.of(range.prefix));

    nums.push(PDFNumber.of(range.startPage));
    nums.push(doc.context.register(spec));
  }

  const tree = doc.context.obj({ Nums: doc.context.obj(nums) });
  doc.catalog.set(PDFName.of('PageLabels'), doc.context.register(tree));
}

/**
 * Write a page transition into a page.
 *
 * A transition is a dictionary on the page that names the effect, how long
 * it lasts and, for the effects that need it, the direction it runs in.
 */
function writePageTransition(doc: PDFDocument, page: PDFPage, transition: PageTransition): void {
  const trans = doc.context.obj({});
  trans.set(PDFName.of('S'), PDFName.of(transition.style));
  trans.set(PDFName.of('D'), PDFNumber.of(transition.duration));

  // The effects that sweep across the page need a direction and, for some
  // of them, the way the new page arrives.
  if (['Split', 'Blinds', 'Box', 'Wipe'].includes(transition.style)) {
    trans.set(PDFName.of('Dm'), PDFName.of('H'));
  }
  if (['Split', 'Blinds', 'Box', 'Wipe', 'Fly', 'Push', 'Cover', 'Uncover'].includes(transition.style)) {
    trans.set(PDFName.of('M'), PDFName.of('I'));
  }
  if (transition.style === 'Fly') {
    trans.set(PDFName.of('Di'), PDFNumber.of(0));
  }

  page.node.set(PDFName.of('Trans'), doc.context.register(trans));
}

/**
 * Write a page box into a page.
 *
 * The box is measured inward from the media box, which is the way the
 * print dialog of a reader shows it.
 */
function writePageBox(
  doc: PDFDocument,
  page: PDFPage,
  settings: PageBoxSettings,
): void {
  const media = page.getMediaBox();
  const x0 = media.x + settings.left;
  const y0 = media.y + settings.bottom;
  const x1 = media.x + media.width - settings.right;
  const y1 = media.y + media.height - settings.top;

  // A box that would collapse is not written; the media box stays in place.
  if (x1 - x0 < 1 || y1 - y0 < 1) return;

  page.node.set(
    PDFName.of(settings.box),
    doc.context.obj([x0, y0, x1, y1]),
  );
}

/**
 * Write the bookmarks of the document into the output.
 *
 * The outline is a tree of dictionaries chained through /Next and /Prev,
 * with the children of an item held in its /First and /Last. The count of
 * an item is the number of its visible children, and negative when the
 * item is closed — which is what a reader uses to decide whether to show
 * the branch.
 */
function writeOutline(
  doc: PDFDocument,
  bookmarks: PdfBookmark[],
  targetPageRef: (sourcePageIndex: number) => PDFRef | undefined,
): void {
  if (bookmarks.length === 0) return;

  /**
   * Write one level of the tree and return the references of its items.
   *
   * The items are written before their children so that a child can name
   * its parent, and the /Next chain is closed afterwards.
   */
  const writeLevel = (items: PdfBookmark[], parentRef?: PDFRef): PDFRef[] => {
    const built: Array<{ dict: PDFDict; ref: PDFRef }> = [];

    for (const item of items) {
      const outline = doc.context.obj({ Title: PDFHexString.fromText(item.title) });
      const ref = doc.context.register(outline);
      built.push({ dict: outline, ref });

      const target = targetPageRef(item.pageIndex);
      if (target) {
        outline.set(
          PDFName.of('Dest'),
          doc.context.obj([
            target,
            PDFName.of('XYZ'),
            PDFNull,
            item.top !== undefined ? PDFNumber.of(item.top) : PDFNull,
            PDFNull,
          ]),
        );
      }

      if (parentRef) outline.set(PDFName.of('Parent'), parentRef);

      if (item.children && item.children.length > 0) {
        const children = writeLevel(item.children, ref);
        if (children.length > 0) {
          outline.set(PDFName.of('First'), children[0]!);
          outline.set(PDFName.of('Last'), children[children.length - 1]!);
          outline.set(PDFName.of('Count'), PDFNumber.of(children.length));
        }
      }
    }

    // The siblings are a /Next chain. Without it only the first bookmark of
    // a level would be reachable.
    for (let i = 0; i < built.length - 1; i += 1) {
      built[i]!.dict.set(PDFName.of('Next'), built[i + 1]!.ref);
    }

    return built.map((b) => b.ref);
  };

  const top = writeLevel(bookmarks);
  if (top.length === 0) return;

  const root = doc.context.obj({ Type: PDFName.of('Outlines') });
  const rootRef = doc.context.register(root);
  root.set(PDFName.of('First'), top[0]!);
  root.set(PDFName.of('Last'), top[top.length - 1]!);
  root.set(PDFName.of('Count'), PDFNumber.of(top.length));
  doc.catalog.set(PDFName.of('Outlines'), rootRef);
}

/**
 * Put the interactive form back into the output document.
 *
 * Copying a page copies its widgets, but the catalog of the output never
 * pointed at the field dictionaries, so the saved file lost the form: the
 * fields had no name, no value and no way to be filled in. The field
 * dictionaries are reachable from the copied widgets, either directly
 * (a merged field) or through their /Parent (a split field), and this
 * collects them and registers them in the catalog again.
 */
function restoreAcroForm(
  srcDoc: PDFDocument,
  outDoc: PDFDocument,
  outPages: PDFPage[],
  needsAppearances: boolean,
): void {
  const srcAcro = resolveObject(srcDoc, srcDoc.catalog.get(PDFName.of('AcroForm')));
  if (!(srcAcro instanceof PDFDict)) return;

  const fieldRefs: PDFRef[] = [];
  const seen = new Set<string>();

  for (const page of outPages) {
    const raw = page.node.get(PDFName.of('Annots'));
    const arr = resolveObject(outDoc, raw);
    if (!(arr instanceof PDFArray)) continue;

    for (const entry of arr.asArray()) {
      if (!(entry instanceof PDFRef)) continue;
      const dict = resolveObject(outDoc, entry);
      if (!(dict instanceof PDFDict)) continue;
      if (annotationSubtype(outDoc, dict) !== 'Widget') continue;

      const parent = dict.get(PDFName.of('Parent'));
      const fieldRef =
        parent instanceof PDFRef
          ? parent
          : dict.get(PDFName.of('T')) !== undefined
            ? entry
            : undefined;
      if (!(fieldRef instanceof PDFRef)) continue;

      const key = fieldRef.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      fieldRefs.push(fieldRef);
    }
  }

  if (fieldRefs.length === 0) return;

  const acro = outDoc.context.obj({ Fields: outDoc.context.obj(fieldRefs) });

  const da = resolveObject(srcDoc, srcAcro.get(PDFName.of('DA')));
  if (da instanceof PDFString) acro.set(PDFName.of('DA'), PDFString.of(da.asString()));

  if (needsAppearances) {
    // The reader redraws the fields itself, with a font that can hold the
    // text, when the value could not be drawn here.
    acro.set(PDFName.of('NeedAppearances'), outDoc.context.obj(true));
  }

  outDoc.catalog.set(PDFName.of('AcroForm'), outDoc.context.register(acro));
}

/**
 * Remove what the document inspector was asked to remove.
 */
function applySanitizeOptions(doc: PDFDocument, options: SanitizeOptions | undefined): void {
  if (!options) return;

  if (options.metadata) {
    const infoRef = doc.context.trailerInfo.Info;
    if (infoRef instanceof PDFRef) {
      const info = doc.context.lookup(infoRef);
      if (info instanceof PDFDict) {
        for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
          info.delete(PDFName.of(key));
        }
      }
    }
  }

  if (options.xmp) {
    doc.catalog.delete(PDFName.of('Metadata'));
  }

  if (options.attachments) {
    doc.catalog.delete(PDFName.of('AF'));
    const names = resolveObject(doc, doc.catalog.get(PDFName.of('Names')));
    if (names instanceof PDFDict) {
      names.delete(PDFName.of('EmbeddedFiles'));
      if (names.keys().length === 0) doc.catalog.delete(PDFName.of('Names'));
    }
  }

  if (options.javascript) {
    const names = resolveObject(doc, doc.catalog.get(PDFName.of('Names')));
    if (names instanceof PDFDict) {
      names.delete(PDFName.of('JavaScript'));
      if (names.keys().length === 0) doc.catalog.delete(PDFName.of('Names'));
    }
    const openAction = resolveObject(doc, doc.catalog.get(PDFName.of('OpenAction')));
    if (openAction instanceof PDFDict) doc.catalog.delete(PDFName.of('OpenAction'));
    doc.catalog.delete(PDFName.of('AA'));
    for (const page of doc.getPages()) page.node.delete(PDFName.of('AA'));
  }

  if (options.formFields) {
    doc.catalog.delete(PDFName.of('AcroForm'));
  }
}

/**
 * True when the document can be written without rebuilding it.
 *
 * The exporter normally builds a new document and copies the pages into it,
 * because the pages may have been reordered, deleted or rotated. When none
 * of that happened, the document is written in place instead: the original
 * file is loaded, the changes are made on it and it is written back. That
 * keeps everything the exporter does not know about — the tags of an
 * accessible document, the embedded files, the optional content groups,
 * the viewer settings — because those objects are never touched.
 */
function canWriteInPlace(docState: PDFDocumentState): boolean {
  const pages = docState.pages;
  if (pages.length !== docState.pageOrder.length) return false;

  for (let i = 0; i < docState.pageOrder.length; i += 1) {
    const index = docState.pageOrder[i];
    if (index !== i) return false;
    const page = pages.find((p) => p.pageIndex === index);
    if (!page) return false;
    if (page.isDeleted || page.isBlank) return false;
    if ((page.rotation ?? 0) % 360 !== 0) return false;
  }

  return true;
}

/**
 * Write the document without rebuilding it.
 *
 * Everything the exporter writes is written onto the loaded file, so the
 * objects it does not know about stay exactly as they were.
 */
async function exportInPlace(
  docState: PDFDocumentState,
  options: {
    onRedactionProgress?: (percent: number) => void;
    onAnnotationFailure?: (types: string[]) => void;
    redactionQuality?: RedactionQuality;
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docState.data!, { updateMetadata: false });

  const needsAppearances = await applyFormValues(doc, docState.formValues);

  const fonts: ExportFonts = {
    Helvetica: await doc.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await doc.embedFont(StandardFonts.HelveticaBold),
    Times: await doc.embedFont(StandardFonts.TimesRoman),
    TimesBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    Courier: await doc.embedFont(StandardFonts.Courier),
    CourierBold: await doc.embedFont(StandardFonts.CourierBold),
  };

  const pages = doc.getPages();
  const failed: Annotation[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]!;
    const { height } = page.getSize();

    for (const ann of docState.annotations[pageIndex] || []) {
      try {
        await renderAnnotationToPdfPage(ann, page, doc, height, fonts);
      } catch (err) {
        console.error('Annotation render error for', ann.id, err);
        failed.push(ann);
      }
    }

    if (failed.length > 0) options.onAnnotationFailure?.(failed.map((a) => a.type));

    const pageComments = (docState.comments ?? []).filter((c) => c.pageIndex === pageIndex);
    rewritePageAnnotations(
      doc,
      page,
      pageComments,
      docState.sanitize,
      docState.links !== undefined,
    );
  }

  // The links are written once every page exists, because a link may point
  // at a page that comes later in the document.
  if (!docState.sanitize?.links && docState.links) {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageLinks = docState.links.filter((l) => l.pageIndex === pageIndex);
      if (pageLinks.length === 0) continue;
      const page = pages[pageIndex]!;
      const refs = writeLinks(doc, page, pageLinks, page.getHeight(), (target) =>
        pages[target]?.ref,
      );
      appendAnnotations(doc, page, refs);
    }
  }

  // The bookmarks are written from the app's list, so a bookmark the user
  // renamed or removed stays that way.
  if (docState.bookmarks) {
    doc.catalog.delete(PDFName.of('Outlines'));
    writeOutline(doc, docState.bookmarks, (sourcePageIndex) => pages[sourcePageIndex]?.ref);
  }

  if (docState.pageTransitions || docState.pageBoxes) {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex]!;

      const transition = (docState.pageTransitions ?? []).find((t) => t.pageIndex === pageIndex);
      if (transition) writePageTransition(doc, page, transition);

      const box = (docState.pageBoxes ?? []).find((b) => b.pageIndex === pageIndex);
      if (box) writePageBox(doc, page, box);
    }
  }

  if (docState.pageLabels && docState.pageLabels.length > 0) {
    writePageLabels(doc, docState.pageLabels);
  }

  applyAccessibility(doc, docState.accessibility, undefined, docState.pdfa);
  applyLayerVisibility(doc, docState.layerVisibility);

  applySanitizeOptions(doc, docState.sanitize);

  // The producer names the tool that wrote the file; the rest of the
  // document information is the document's own.
  if (!docState.sanitize?.metadata) {
    doc.setProducer(`${APP_NAME} ${APP_VERSION}`);
  } else {
    applySanitizeOptions(doc, { metadata: true });
  }
  if (needsAppearances) {
    // A reader redraws the fields it cannot draw itself.
    const acro = resolveObject(doc, doc.catalog.get(PDFName.of('AcroForm')));
    if (acro instanceof PDFDict) {
      acro.set(PDFName.of('NeedAppearances'), doc.context.obj(true));
    }
  }

  // The appearances of the fields are written here, so the library must
  // not touch them again.
  const bytes = await doc.save({ updateFieldAppearances: false });

  return await applyRedactions(
    bytes,
    collectRedactions(docState),
    options.onRedactionProgress,
    options.redactionQuality,
  );
}

/**
 * Apply the accessibility settings to the document.
 *
 * The tagging is written on the document as it is handed over, so the
 * figures and their descriptions land on the pages the reader sees.
 *
 * @param remapKey Turns the key of a figure into the key of the same figure
 *   on the document that is written. It is needed when the pages were
 *   reordered, because the key holds the number of the page.
 */
function applyAccessibility(
  doc: PDFDocument,
  accessibility: AccessibilityState | undefined,
  remapKey?: (key: string) => string,
  pdfaTarget?: PdfaTarget,
): void {
  if (accessibility) {
    if (accessibility.tagged) {
      const altTexts: Record<string, string> = {};
      for (const [key, value] of Object.entries(accessibility.altTexts ?? {})) {
        altTexts[remapKey ? remapKey(key) : key] = value;
      }
      tagDocument(doc, altTexts);
    }

    if (accessibility.language) setDocumentLanguage(doc, accessibility.language);
    if (accessibility.title !== undefined) setDocumentTitle(doc, accessibility.title);
    if (accessibility.displayDocTitle) setDisplayDocTitle(doc, true);
    if (accessibility.fieldDescriptions) setFieldDescriptions(doc);
  }

  if (pdfaTarget) {
    // The metadata that declares the document as an archival file, and the
    // identifier the file needs.
    writePdfAMetadata(doc, pdfaTarget, {
      title: accessibility?.title,
    });
    writeDocumentId(doc);
  }
}

/**
 * Write the optional content of the document into the output.
 *
 * The layers of the source are carried over: the pages of the output
 * already point at their groups through their resources, so the groups are
 * collected from there and the catalog is pointed at them again. Which of
 * them is turned off is taken from the state the user chose.
 */
function copyOptionalContent(
  outDoc: PDFDocument,
  outPages: PDFPage[],
  states: Record<string, boolean> | undefined,
): void {
  const groups = new Map<string, PDFRef>();

  for (const page of outPages) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const props = resolveObject(outDoc, resources.get(PDFName.of('Properties')));
    if (!(props instanceof PDFDict)) continue;
    for (const [, value] of props.entries()) {
      if (value instanceof PDFRef) groups.set(value.toString(), value);
    }
  }

  if (groups.size === 0) return;

  const off: PDFRef[] = [];
  for (const ref of groups.values()) {
    const group = resolveObject(outDoc, ref);
    if (!(group instanceof PDFDict)) continue;

    const name = resolveObject(outDoc, group.get(PDFName.of('Name')));
    const text =
      name instanceof PDFName || name instanceof PDFString || name instanceof PDFHexString
        ? name.decodeText()
        : '';
    if (!text) continue;

    if (states?.[text] === false) off.push(ref);
  }

  const properties = outDoc.context.obj({
    OCGs: outDoc.context.obj(Array.from(groups.values())),
    D: outDoc.context.obj({
      OFF: outDoc.context.obj(off),
      BaseState: PDFName.of('ON'),
      Order: outDoc.context.obj(Array.from(groups.values())),
    }),
  });

  outDoc.catalog.set(PDFName.of('OCProperties'), outDoc.context.register(properties));
}

/**
 * Turn the layers of the document on and off.
 *
 * A layer is turned off by being named in the /OFF list of the default
 * configuration of the optional content, which is how a reader stores the
 * state it was left in.
 *
 * @param states The state of every layer, keyed by the name of the layer.
 */
function applyLayerVisibility(
  doc: PDFDocument,
  states: Record<string, boolean> | undefined,
): void {
  if (!states) return;

  const properties = resolveObject(doc, doc.catalog.get(PDFName.of('OCProperties')));
  if (!(properties instanceof PDFDict)) return;

  const groups = resolveObject(doc, properties.get(PDFName.of('OCGs')));
  if (!(groups instanceof PDFArray)) return;

  const configuration = resolveObject(doc, properties.get(PDFName.of('D')));
  if (!(configuration instanceof PDFDict)) return;

  // The list of the layers that are turned off.
  const existing = resolveObject(doc, configuration.get(PDFName.of('OFF')));
  const off: PDFArray = existing instanceof PDFArray ? existing : doc.context.obj([]);
  if (!(existing instanceof PDFArray)) {
    configuration.set(PDFName.of('OFF'), off);
  }

  const isOff = new Set<string>();
  for (const entry of off.asArray()) {
    if (entry instanceof PDFRef) isOff.add(entry.toString());
  }

  groups.asArray().forEach((entry) => {
    if (!(entry instanceof PDFRef)) return;
    const group = resolveObject(doc, entry);
    if (!(group instanceof PDFDict)) return;

    const name = resolveObject(doc, group.get(PDFName.of('Name')));
    const text =
      name instanceof PDFName || name instanceof PDFString || name instanceof PDFHexString
        ? name.decodeText()
        : '';
    if (!text) return;

    const wanted = states[text];
    if (wanted === undefined) return;

    const key = entry.toString();
    if (wanted) {
      isOff.delete(key);
    } else if (!isOff.has(key)) {
      isOff.add(key);
    }
  });

  const next = doc.context.obj(Array.from(isOff));
  configuration.set(PDFName.of('OFF'), next);
}

/**
 * Serialise the document to PDF bytes, annotations included.
 *
 * @param onRedactionProgress Progress callback for the rasterisation step that
 *   permanently destroys redacted pages. See `utils/redaction.ts`.
 */
export async function exportModifiedPdf(
  docState: PDFDocumentState,
  options: {
    /** Progress of the permanent-redaction rasterisation step, 0-100. */
    onRedactionProgress?: (percent: number) => void;
    /**
     * Called with the types of annotations that could not be written. The save
     * still succeeds, so the caller is expected to warn the user.
     */
    onAnnotationFailure?: (types: string[]) => void;
    /** Raster resolution for redacted pages. Ignored if there are none. */
    redactionQuality?: RedactionQuality;
  } = {},
): Promise<Uint8Array> {
  if (!docState.data) {
    throw new Error('No PDF document loaded.');
  }

  // A document whose pages were not reordered, deleted or rotated is
  // written in place, so the parts of the file the exporter does not know
  // about survive the save.
  if (canWriteInPlace(docState)) {
    try {
      return await exportInPlace(docState, options);
    } catch (err) {
      // The in-place path is the faster one but it cannot handle every
      // document; the rebuild below is the fallback that always works.
      console.warn('In-place save failed, rebuilding the document:', err);
    }
  }

  // Load existing PDF document
  // The metadata of the source is read as it is in the file: pdf-lib stamps
  // its own name over the producer and the creator of every document it
  // loads, which would throw the original creator away.
  const srcDoc = await PDFDocument.load(docState.data, { updateMetadata: false });
  const outDoc = await PDFDocument.create();

  // Fill the interactive form before the pages are copied, so the values and
  // the appearances that go with them travel with the page into the output.
  const needsAppearances = await applyFormValues(srcDoc, docState.formValues);

  // Pre-embed standard fonts. The bold faces of Times and Courier are embedded
  // too, so a bold serif or monospace annotation exports bold instead of
  // silently losing its weight.
  const fontHelvetica = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await outDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await outDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontCourier = await outDoc.embedFont(StandardFonts.Courier);
  const fontCourierBold = await outDoc.embedFont(StandardFonts.CourierBold);

  // Copy pages in the desired order (filtering out deleted ones)
  const validPageIndices = docState.pageOrder.filter(idx => {
    const pageState = docState.pages.find(p => p.pageIndex === idx);
    return pageState && !pageState.isDeleted;
  });

  if (validPageIndices.length === 0) {
    throw new Error('Belgede kaydedilecek sayfa bulunamadı.');
  }

  // Destination page object in the output document -> its source page number.
  // Populated while pages are written, consumed when the outline is rebuilt.
  const outlineRemap = new Map<PDFRef, number>();

  // The output pages, kept so the form can be restored once they all exist.
  const outPages: PDFPage[] = [];

  // The page of the output that came from a source page, so a link can
  // point at the right sheet after the pages were reordered.
  const outputPageBySourceNumber = new Map<number, PDFPage>();

  // The source page of every page of the output, the other way round.
  const sourceIndexByOutputIndex = new Map<number, number>();

  for (let i = 0; i < validPageIndices.length; i++) {
    const pageIndex = validPageIndices[i];
    if (pageIndex === undefined) continue;
    const pageState = docState.pages.find(p => p.pageIndex === pageIndex);
    if (!pageState) continue;

    let outPage: PDFPage;

    if (pageState.isBlank || pageState.originalPageNumber === 0) {
      // Create a pristine blank page
      outPage = outDoc.addPage([pageState.width || 595.28, pageState.height || 841.89]);
    } else {
      // Copy existing page from source doc
      const [copiedPage] = await outDoc.copyPages(srcDoc, [pageState.originalPageNumber - 1]);
      outPage = outDoc.addPage(copiedPage);
    }

    // Bookmark destinations refer to pages by *object reference*, so after a
    // reorder, a deletion or an inserted blank page the original references no
    // longer point at the right sheet. Capturing the index here and patching the
    // outline after the loop is what keeps navigation landing correctly.
    outlineRemap.set(outPage.ref, pageState.originalPageNumber);
    outputPageBySourceNumber.set(pageState.originalPageNumber, outPage);
    sourceIndexByOutputIndex.set(i, pageIndex);

    // Apply rotation
    if (pageState && pageState.rotation !== undefined) {
      const currentRot = outPage.getRotation().angle;
      outPage.setRotation(degrees((currentRot + pageState.rotation) % 360));
    }

    // Get current page dimensions for coordinate matching
    const { width: _pWidth, height: pHeight } = outPage.getSize();

    // Render annotations for this page
    const pageAnnotations = docState.annotations[pageIndex] || [];
    const failed: Annotation[] = [];

    for (const ann of pageAnnotations) {
      try {
        await renderAnnotationToPdfPage(ann, outPage, outDoc, pHeight, {
          Helvetica: fontHelvetica,
          HelveticaBold: fontHelveticaBold,
          Times: fontTimes,
          TimesBold: fontTimesBold,
          Courier: fontCourier,
          CourierBold: fontCourierBold,
        });
      } catch (err) {
        // Collected rather than merely logged: a silently dropped signature or
        // stamp is worse than a visible warning, because the user is told the
        // save succeeded.
        console.error('Annotation render error for', ann.id, err);
        failed.push(ann);
      }
    }

    if (failed.length > 0) options.onAnnotationFailure?.(failed.map((a) => a.type));

    // The page's own annotations are rewritten here: the comments that came
    // with the file are replaced by the app's list, and the document
    // inspector removes what it was asked to remove.
    const pageComments = (docState.comments ?? []).filter((c) => c.pageIndex === pageIndex);
    rewritePageAnnotations(
      outDoc,
      outPage,
      pageComments,
      docState.sanitize,
      // The links are only taken over when the app actually read them. A
      // document whose links could not be read keeps the ones it came with.
      docState.links !== undefined,
    );

    outPages.push(outPage);
  }

  // The page transitions and the page boxes belong to a single page, so they
  // are written while the page is at hand.
  if (docState.pageTransitions || docState.pageBoxes) {
    for (const [sourceNumber, outPage] of outputPageBySourceNumber) {
      const sourceIndex = sourceNumber - 1;

      const transition = (docState.pageTransitions ?? []).find((t) => t.pageIndex === sourceIndex);
      if (transition) writePageTransition(outDoc, outPage, transition);

      const box = (docState.pageBoxes ?? []).find((b) => b.pageIndex === sourceIndex);
      if (box) writePageBox(outDoc, outPage, box);
    }
  }

  // The page labels belong to the catalog, so they are written once.
  if (docState.pageLabels && docState.pageLabels.length > 0) {
    writePageLabels(outDoc, docState.pageLabels);
  }

  // The accessibility settings are written on the output, where the pages
  // of the output live. The figures are matched by the page they were
  // found on, so the pages that were reordered are mapped back.
  copyOptionalContent(outDoc, outPages, docState.layerVisibility);
  applyLayerVisibility(outDoc, docState.layerVisibility);

  applyAccessibility(
    outDoc,
    docState.accessibility,
    (key) => {
      const [pagePart, namePart] = key.split(':');
      const sourceIndex = Number(pagePart);
      const outputIndex = sourceIndexByOutputIndex.get(sourceIndex);
      return outputIndex === undefined ? key : `${outputIndex}:${namePart ?? ''}`;
    },
    docState.pdfa,
  );

  // The links are written once every page exists, because a link may point
  // at a page that comes later in the document.
  if (!docState.sanitize?.links && docState.links) {
    const targetPageRef = (sourcePageIndex: number) =>
      outputPageBySourceNumber.get(sourcePageIndex + 1)?.ref;

    for (const [sourceNumber, outPage] of outputPageBySourceNumber) {
      const pageLinks = docState.links.filter((l) => l.pageIndex === sourceNumber - 1);
      if (pageLinks.length === 0) continue;
      const refs = writeLinks(outDoc, outPage, pageLinks, outPage.getHeight(), targetPageRef);
      appendAnnotations(outDoc, outPage, refs);
    }
  }

  // Everything below runs before `save`, and all of it is best-effort: failing to
  // carry a bookmark or a metadata field across must never cost the user their
  // actual edits.

  if (!docState.sanitize?.metadata) {
    copyDocumentInfo(srcDoc, outDoc);
  }

  // The bookmarks are written from the app's list, so a bookmark the user
  // renamed or removed stays that way. A document whose outline could not
  // be read keeps the one it came with.
  if (docState.bookmarks) {
    writeOutline(outDoc, docState.bookmarks, (sourcePageIndex) =>
      outputPageBySourceNumber.get(sourcePageIndex + 1)?.ref,
    );
  } else {
    await copyOutlines(srcDoc, outDoc, outlineRemap);
  }

  // The form is put back after the pages exist, because the field
  // dictionaries are reached through the copied widgets.
  if (!docState.sanitize?.formFields) {
    restoreAcroForm(srcDoc, outDoc, outPages, needsAppearances);
  }

  applySanitizeOptions(outDoc, docState.sanitize);

  const bytes = await outDoc.save();

  // Destroy redacted pages, if any. Runs after the vector pass so the
  // re-render also captures the other annotations flattened into the page.
  return await applyRedactions(
    bytes,
    collectRedactions(docState),
    options.onRedactionProgress,
    options.redactionQuality,
  );
}

async function renderAnnotationToPdfPage(
  ann: Annotation,
  page: PDFPage,
  doc: PDFDocument,
  pHeight: number,
  fonts: ExportFonts
) {
  // Convert standard coordinate system (Origin at top-left in web canvas vs bottom-left in PDF)
  // ann.y in canvas is from top, so pdfY = pHeight - ann.y - ann.height (or specific point)

  const strokeColor = hexToRgb(ann.color) || rgb(0, 0, 0);
  const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;

  switch (ann.type) {
    // Redaction is deliberately not drawn here. Painting a rectangle leaves the
    // text underneath intact in the content stream, which is exactly the
    // failure mode permanent redaction exists to prevent. The boxes are instead
    // collected and destroyed by `applyRedactions`, which rasterises the page.

    case 'rect': {
      const shape = ann as ShapeAnnotation;
      const pdfY = pHeight - shape.y - shape.height;
      const fillRgb = shape.fillColor && shape.fillColor !== 'transparent' ? hexToRgb(shape.fillColor) : undefined;
      page.drawRectangle({
        x: shape.x,
        y: pdfY,
        width: shape.width,
        height: shape.height,
        borderColor: strokeColor,
        borderWidth: shape.strokeWidth || 2,
        color: fillRgb || undefined,
        opacity: opacity,
      });
      break;
    }

    case 'circle': {
      const shape = ann as ShapeAnnotation;
      const radiusX = shape.width / 2;
      const radiusY = shape.height / 2;
      const centerX = shape.x + radiusX;
      const centerY = pHeight - (shape.y + radiusY);
      const fillRgb = shape.fillColor && shape.fillColor !== 'transparent' ? hexToRgb(shape.fillColor) : undefined;

      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: radiusX,
        yScale: radiusY,
        borderColor: strokeColor,
        borderWidth: shape.strokeWidth || 2,
        color: fillRgb || undefined,
        opacity: opacity,
      });
      break;
    }

    case 'line': {
      const shape = ann as ShapeAnnotation;
      const startX = shape.x;
      const startY = pHeight - shape.y;
      const endX = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
      const endY = pHeight - (shape.endY !== undefined ? shape.endY : shape.y + shape.height);

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: shape.strokeWidth || 2,
        color: strokeColor,
        opacity: opacity,
      });
      break;
    }

    case 'arrow': {
      const shape = ann as ShapeAnnotation;
      const startX = shape.x;
      const startY = pHeight - shape.y;
      const endX = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
      const endY = pHeight - (shape.endY !== undefined ? shape.endY : shape.y + shape.height);
      const thickness = shape.strokeWidth || 2;

      // Draw main line
      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });

      // Calculate arrow head points
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = Math.max(12, thickness * 4);
      const arrowAngle = Math.PI / 6; // 30 degrees

      const leftX = endX - headLen * Math.cos(angle - arrowAngle);
      const leftY = endY - headLen * Math.sin(angle - arrowAngle);
      const rightX = endX - headLen * Math.cos(angle + arrowAngle);
      const rightY = endY - headLen * Math.sin(angle + arrowAngle);

      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: leftX, y: leftY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });

      page.drawLine({
        start: { x: endX, y: endY },
        end: { x: rightX, y: rightY },
        thickness: thickness,
        color: strokeColor,
        opacity: opacity,
      });
      break;
    }

    case 'pen':
    case 'highlighter': {
      const drawAnn = ann as DrawingAnnotation;
      if (!drawAnn.points || drawAnn.points.length < 2) break;

      const isHighlighter = drawAnn.type === 'highlighter';
      const drawOpacity = isHighlighter ? (drawAnn.opacity || 0.4) : (drawAnn.opacity || 1.0);
      const thickness = drawAnn.strokeWidth || (isHighlighter ? 18 : 3);

      for (let i = 0; i < drawAnn.points.length - 1; i++) {
        const p1 = drawAnn.points[i];
        const p2 = drawAnn.points[i + 1];
        if (!p1 || !p2) continue;

        page.drawLine({
          start: { x: p1.x, y: pHeight - p1.y },
          end: { x: p2.x, y: pHeight - p2.y },
          thickness: thickness,
          color: strokeColor,
          opacity: drawOpacity,
          lineCap: LineCapStyle.Round,
        });
      }
      break;
    }

    case 'text': {
      const textAnn = ann as TextAnnotation;
      const font = pickFont(textAnn.fontFamily, textAnn.fontWeight, fonts);

      const fontSize = textAnn.fontSize || 14;
      // Text is drawn on its baseline, which sits a descender below the box the
      // viewer lays out. Centring the baseline in that box keeps the exported
      // text where the preview showed it.
      const pdfY = pHeight - textAnn.y - fontSize * 0.8;

      // Draw background if present
      if (textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent') {
        const bgRgb = hexToRgb(textAnn.backgroundColor);
        if (bgRgb) {
          page.drawRectangle({
            x: textAnn.x - 4,
            y: pdfY - 4,
            width: textAnn.width + 8,
            height: textAnn.height + 8,
            color: bgRgb,
            opacity: 0.9,
          });
        }
      }

      // Handle multi-line text
      const lines = textAnn.text.split('\n');
      const lineHeight = fontSize * 1.25;

      lines.forEach((line, lineIndex) => {
        if (!line.trim() && lines.length === 1) return;
        const safeLine = toWinAnsi(line);
        if (!safeLine) return;

        // Honour the alignment the toolbar offers. Previously `textAlign` was
        // ignored and every line was left-aligned, so a centred watermark
        // exported flush left.
        const lineWidth = font.widthOfTextAtSize(safeLine, fontSize);
        const boxWidth = textAnn.width || lineWidth;
        const drawX =
          textAnn.textAlign === 'center'
            ? textAnn.x + (boxWidth - lineWidth) / 2
            : textAnn.textAlign === 'right'
              ? textAnn.x + boxWidth - lineWidth
              : textAnn.x;

        const drawOptions = {
          x: drawX,
          y: pdfY - lineIndex * lineHeight,
          size: fontSize,
          font,
          color: strokeColor,
          opacity,
          // Without this a rotated annotation exported upright.
          ...(textAnn.rotation ? { rotate: degrees(textAnn.rotation) } : {}),
        };

        if (textAnn.rotation) {
          // pdf-lib rotates about (x, y), so the origin has to move to the box
          // centre for the text to pivot where the viewer showed it.
          const cx = textAnn.x + (textAnn.width || lineWidth) / 2;
          const cy = pHeight - textAnn.y - (textAnn.height || fontSize);
          drawOptions.x = cx;
          drawOptions.y = cy;
        }

        page.drawText(safeLine, drawOptions);
      });
      break;
    }

    case 'signature': {
      const sigAnn = ann as SignatureAnnotation;
      if (!sigAnn.imageData) break;

      try {
        const imageBytes = await fetch(sigAnn.imageData).then(res => res.arrayBuffer());
        const pngImage = await doc.embedPng(imageBytes);
        const pdfY = pHeight - sigAnn.y - sigAnn.height;

        page.drawImage(pngImage, {
          x: sigAnn.x,
          y: pdfY,
          width: sigAnn.width,
          height: sigAnn.height,
          opacity: opacity,
        });
      } catch (e) {
        console.error('Failed to embed signature PNG:', e);
      }
      break;
    }

    case 'stamp': {
      const stampAnn = ann as StampAnnotation;
      const pdfY = pHeight - stampAnn.y - stampAnn.height;
      const stampColor = hexToRgb(stampAnn.color || '#e11d48') || rgb(0.88, 0.11, 0.28);

      // Draw Stamp Outer Double Border
      page.drawRectangle({
        x: stampAnn.x,
        y: pdfY,
        width: stampAnn.width,
        height: stampAnn.height,
        borderColor: stampColor,
        borderWidth: 3,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });

      page.drawRectangle({
        x: stampAnn.x + 3,
        y: pdfY + 3,
        width: stampAnn.width - 6,
        height: stampAnn.height - 6,
        borderColor: stampColor,
        borderWidth: 1,
        opacity: 0.9,
      });

      const mainText = toWinAnsi(stampAnn.customText || stampAnn.stampType);
      const font = fonts.HelveticaBold;
      const textWidth = font.widthOfTextAtSize(mainText, 16);
      const textX = stampAnn.x + (stampAnn.width - textWidth) / 2;
      const textY = pdfY + stampAnn.height / 2 - 5;

      page.drawText(mainText, {
        x: Math.max(stampAnn.x + 6, textX),
        y: textY,
        size: 16,
        font: font,
        color: stampColor,
      });

      if (stampAnn.date || stampAnn.subtitle) {
        const sub = toWinAnsi(stampAnn.date || stampAnn.subtitle || '');
        const subFont = fonts.Helvetica;
        const subWidth = subFont.widthOfTextAtSize(sub, 9);
        const subX = stampAnn.x + (stampAnn.width - subWidth) / 2;
        page.drawText(sub, {
          x: Math.max(stampAnn.x + 6, subX),
          y: textY - 14,
          size: 9,
          font: subFont,
          color: stampColor,
        });
      }
      break;
    }

    case 'image': {
      const imgAnn = ann as any;
      if (!imgAnn.imageData) break;

      try {
        const imageBytes = await fetch(imgAnn.imageData).then((res) => res.arrayBuffer());
        const isPng = imgAnn.imageData.includes('image/png') || imgAnn.imageData.startsWith('data:image/png');
        const pdfImage = isPng ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
        const pdfY = pHeight - imgAnn.y - imgAnn.height;

        page.drawImage(pdfImage, {
          x: imgAnn.x,
          y: pdfY,
          width: imgAnn.width,
          height: imgAnn.height,
          opacity: opacity,
        });
      } catch (e) {
        console.error('Failed to embed image:', e);
      }
      break;
    }

    case 'measure': {
      const measureAnn = ann as any;
      const startX = measureAnn.x;
      const startY = pHeight - measureAnn.y;
      const endX = measureAnn.endX !== undefined ? measureAnn.endX : measureAnn.x + measureAnn.width;
      const endY = pHeight - (measureAnn.endY !== undefined ? measureAnn.endY : measureAnn.y + measureAnn.height);
      const color = hexToRgb(measureAnn.color || '#f59e0b') || rgb(0.96, 0.62, 0.04);

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: 2,
        color: color,
        opacity: opacity,
      });

      const text = toWinAnsi(measureAnn.distanceFormatted || '0 cm');
      const font = fonts.HelveticaBold;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + 5;
      page.drawText(text, {
        x: midX,
        y: midY,
        size: 10,
        font: font,
        color: color,
      });
      break;
    }

    case 'checkbox': {
      const cbAnn = ann as any;
      const pdfY = pHeight - cbAnn.y - cbAnn.height;
      const color = hexToRgb(cbAnn.color || '#0f172a') || rgb(0.1, 0.1, 0.2);

      page.drawRectangle({
        x: cbAnn.x,
        y: pdfY,
        width: cbAnn.width || 18,
        height: cbAnn.height || 18,
        borderColor: color,
        borderWidth: 1.5,
        color: rgb(1, 1, 1),
      });

      if (cbAnn.checked) {
        page.drawLine({
          start: { x: cbAnn.x + 3, y: pdfY + 9 },
          end: { x: cbAnn.x + 7, y: pdfY + 4 },
          thickness: 2,
          color: color,
        });
        page.drawLine({
          start: { x: cbAnn.x + 7, y: pdfY + 4 },
          end: { x: cbAnn.x + 14, y: pdfY + 14 },
          thickness: 2,
          color: color,
        });
      }
      break;
    }
  }
}

export async function createBlankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]); // Standard A4 (595.28 x 841.89 pt)
  return await doc.save();
}
