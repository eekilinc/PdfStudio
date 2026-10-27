/**
 * Reading the parts of a PDF that the app does not own.
 *
 * Everything here works on the *file* rather than on the editing model:
 * comments, interactive form fields and the findings of the document
 * scanner are read out of the original bytes, so the panel shows what the
 * document really holds instead of what this session remembers.
 *
 * The reading is done with pdf-lib rather than with PDF.js because the
 * answers have to survive a save: PDF.js describes what a page *looks*
 * like, while these are the objects that are written back into the file.
 */

import {
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOptionList,
  PDFRadioGroup,
  PDFRawStream,
  PDFRef,
  PDFString,
  PDFTextField,
  decodePDFRawStream,
} from 'pdf-lib';
import type {
  FormFieldInfo,
  FormFieldKind,
  FormFieldValue,
  PageBoxSettings,
  PageLabelRange,
  PageLabelStyle,
  PageTransition,
  PageTransitionStyle,
  PdfAttachment,
  PdfBookmark,
  PdfComment,
  PdfCommentKind,
  PdfCommentStatus,
  PdfLayer,
  PdfLink,
  PdfRect,
  SanitizeFinding,
} from '../types/pdf';

/** PDF subtypes that carry a review comment, and the kind they map to. */
const COMMENT_SUBTYPES: Record<string, PdfCommentKind> = {
  Text: 'note',
  Highlight: 'highlight',
  Underline: 'underline',
  StrikeOut: 'strikeout',
  FreeText: 'freetext',
};

/** The subtype written for each comment kind. */
export const COMMENT_SUBTYPE_BY_KIND: Record<PdfCommentKind, string> = {
  note: 'Text',
  highlight: 'Highlight',
  underline: 'Underline',
  strikeout: 'StrikeOut',
  freetext: 'FreeText',
};

/** Subtypes the document inspector treats as removable comments. */
export const REMOVABLE_COMMENT_SUBTYPES = Object.keys(COMMENT_SUBTYPES);

/** True when an annotation subtype carries a review comment. */
export function isCommentSubtype(subtype: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMENT_SUBTYPES, subtype);
}

/** Resolve an object that may be stored indirectly. */
function resolve(doc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? doc.context.lookup(value) : value;
}

/** Read a string entry, decoding the UTF-16 form the standard uses. */
function readText(doc: PDFDocument, dict: PDFDict, key: string): string {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
  if (raw instanceof PDFHexString) {
    try {
      return raw.decodeText();
    } catch {
      return raw.asString();
    }
  }
  if (raw instanceof PDFString) {
    try {
      return raw.decodeText();
    } catch {
      return raw.asString();
    }
  }
  if (raw instanceof PDFName) return raw.decodeText();
  return '';
}

/** Read an array of numbers, such as /Rect or /QuadPoints. */
function readNumbers(doc: PDFDocument, dict: PDFDict, key: string): number[] {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
  if (!(raw instanceof PDFArray)) return [];
  const out: number[] = [];
  for (const entry of raw.asArray()) {
    const value = resolve(doc, entry);
    if (value instanceof PDFNumber) out.push(value.asNumber());
  }
  return out;
}

/** Read the /Subtype of an annotation. */
function readSubtype(doc: PDFDocument, dict: PDFDict): string {
  const raw = resolve(doc, dict.get(PDFName.of('Subtype')));
  if (!(raw instanceof PDFName)) return '';
  // `asString` keeps the leading slash, so it is trimmed here once.
  return raw.asString().replace(/^\//, '');
}

/** Read a name entry, such as the kind of an action. */
function readName(doc: PDFDocument, dict: PDFDict, key: string): string {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
  if (!(raw instanceof PDFName)) return '';
  return raw.asString().replace(/^\//, '');
}

/** Read a colour array such as /C [r g b]. */
function readColor(doc: PDFDocument, dict: PDFDict): string | undefined {
  const values = readNumbers(doc, dict, 'C');
  if (values.length < 3) return undefined;
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const hex = (v: number) => to255(v).toString(16).padStart(2, '0');
  return `#${hex(values[0]!)}${hex(values[1]!)}${hex(values[2]!)}`;
}

/** Read a review status from /State, when it is one this app knows. */
function readStatus(doc: PDFDocument, dict: PDFDict): PdfCommentStatus | undefined {
  const raw = resolve(doc, dict.get(PDFName.of('State')));
  if (!(raw instanceof PDFName)) return undefined;
  const value = raw.asString().replace(/^\//, '');
  if (value === 'Accepted' || value === 'Rejected' || value === 'Cancelled' || value === 'Completed') {
    return value;
  }
  return undefined;
}

/**
 * Read the review comments of a document.
 *
 * The rectangles come back in the app's own page space — points, with the
 * origin at the top left of the page as it was authored — so a comment can
 * be drawn on the overlay without another conversion. The PDF's own
 * bottom-left origin is only used while the file is written.
 */
export async function readComments(data: ArrayBuffer | Uint8Array): Promise<PdfComment[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    // An encrypted or damaged file simply has no readable comments.
    return [];
  }
  return readCommentsFromDoc(doc);
}

/** Read the review comments of an already loaded document. */
function readCommentsFromDoc(doc: PDFDocument): PdfComment[] {

  const comments: PdfComment[] = [];
  const idByRef = new Map<string, string>();
  let counter = 0;

  const pages = doc.getPages();
  pages.forEach((page, pageIndex) => {
    const pageHeight = page.getHeight();
    const annots = resolve(doc, page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) return;

    for (const entry of annots.asArray()) {
      const dict = resolve(doc, entry);
      if (!(dict instanceof PDFDict)) continue;
      const kind = COMMENT_SUBTYPES[readSubtype(doc, dict)];
      if (!kind) continue;

      const rect = readNumbers(doc, dict, 'Rect');
      if (rect.length < 4) continue;

      const id = readText(doc, dict, 'NM') || `cmt-${pageIndex}-${counter}`;
      counter += 1;
      if (entry instanceof PDFRef) idByRef.set(entry.toString(), id);

      // A note's rectangle is anchored at its top left corner, so the app's
      // top-left origin needs the height added back.
      const x = Math.min(rect[0]!, rect[2]!);
      const width = Math.abs(rect[2]! - rect[0]!);
      const height = Math.abs(rect[3]! - rect[1]!);
      const topInPdf = Math.min(rect[1]!, rect[3]!);

      const quads = readNumbers(doc, dict, 'QuadPoints');
      const parentRef = dict.get(PDFName.of('IRT'));

      comments.push({
        id,
        pageIndex,
        kind,
        rect: {
          x,
          y: pageHeight - topInPdf - height,
          width,
          height,
        },
        quads: quads.length > 0 ? quads : undefined,
        contents: readText(doc, dict, 'Contents'),
        author: readText(doc, dict, 'T'),
        modified: readText(doc, dict, 'M') || undefined,
        status: readStatus(doc, dict),
        color: readColor(doc, dict),
        parentId: undefined,
      });

      // The reply link is resolved after the walk, because a reply can point
      // at a comment that is defined later in the file.
      if (parentRef instanceof PDFRef) {
        const parentId = idByRef.get(parentRef.toString());
        if (parentId) comments[comments.length - 1]!.parentId = parentId;
      }
    }
  });

  // Second pass for replies whose parent was read after them.
  pages.forEach((page) => {
    const annots = resolve(doc, page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) return;
    for (const entry of annots.asArray()) {
      const dict = resolve(doc, entry);
      if (!(dict instanceof PDFDict)) continue;
      if (!COMMENT_SUBTYPES[readSubtype(doc, dict)]) continue;
      const parentRef = dict.get(PDFName.of('IRT'));
      if (!(parentRef instanceof PDFRef)) continue;
      const parentId = idByRef.get(parentRef.toString());
      if (!parentId) continue;
      const own = readText(doc, dict, 'NM');
      const comment = comments.find((c) => c.id === own);
      if (comment && !comment.parentId) comment.parentId = parentId;
    }
  });

  return comments;
}

/** Read the interactive form fields of a document. */
export async function readFormFields(data: ArrayBuffer | Uint8Array): Promise<FormFieldInfo[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return [];
  }
  return readFormFieldsFromDoc(doc);
}

/**
 * Look a named destination up in the document's destination trees.
 *
 * A destination may be written as an array, as a name in the document's
 * destination trees, or as an action dictionary. All three forms are
 * understood here, because links and bookmarks use them alike.
 */
function namedDestinationOf(doc: PDFDocument, name: string): unknown {
  // The old style: a plain dictionary of names.
  const legacy = resolve(doc, doc.catalog.get(PDFName.of('Dests')));
  if (legacy instanceof PDFDict) {
    const direct = resolve(doc, legacy.get(PDFName.of(name)));
    if (direct) return direct;
  }

  // The name tree of the catalog.
  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  if (!(names instanceof PDFDict)) return undefined;
  const tree = resolve(doc, names.get(PDFName.of('Dests')));
  if (!(tree instanceof PDFDict)) return undefined;

  const walk = (node: PDFDict, depth: number): unknown => {
    if (depth > 16) return undefined;
    const list = resolve(doc, node.get(PDFName.of('Names')));
    if (list instanceof PDFArray) {
      const entries = list.asArray();
      for (let i = 0; i + 1 < entries.length; i += 2) {
        const key = resolve(doc, entries[i]);
        if (key instanceof PDFString || key instanceof PDFHexString || key instanceof PDFName) {
          if (key.decodeText() === name) return resolve(doc, entries[i + 1]);
        }
      }
    }
    const kids = resolve(doc, node.get(PDFName.of('Kids')));
    if (kids instanceof PDFArray) {
      for (const kid of kids.asArray()) {
        const child = resolve(doc, kid);
        if (child instanceof PDFDict) {
          const found = walk(child, depth + 1);
          if (found) return found;
        }
      }
    }
    return undefined;
  };

  return walk(tree, 0);
}

/**
 * The page and the vertical position a destination points at.
 */
function resolveDestination(
  doc: PDFDocument,
  raw: unknown,
): { pageIndex: number; top?: number } | null {
  let dest = raw;
  if (dest instanceof PDFName || dest instanceof PDFString) {
    dest = namedDestinationOf(doc, dest.decodeText());
  }
  if (dest instanceof PDFDict) {
    const inner = resolve(doc, dest.get(PDFName.of('D')));
    if (!inner) return null;
    dest = inner;
  }
  if (!(dest instanceof PDFArray)) return null;

  const entries = dest.asArray();
  const first = entries[0];
  if (first === undefined) return null;

  // The page is held as a reference in a parsed document and directly in
  // one built in memory; both are matched against the page list.
  const pages = doc.getPages();
  let index = -1;
  if (first instanceof PDFRef) {
    pages.forEach((page, i) => {
      if (index === -1 && page.ref.toString() === first.toString()) index = i;
    });
  } else {
    pages.forEach((page, i) => {
      if (index === -1 && first === (page.node as unknown)) index = i;
    });
  }
  if (index === -1) return null;

  let top: number | undefined;
  const topEntry = entries[3];
  if (topEntry !== undefined) {
    const value = resolve(doc, topEntry);
    if (value instanceof PDFNumber) top = value.asNumber();
  }

  return { pageIndex: index, top };
}

/**
 * Read the hyperlinks of an already loaded document.
 *
 * A link is either an address that leaves the document or a jump inside
 * it. Both forms are recognised: the address is an action (`/A`), the jump
 * is a destination (`/Dest`), which may be written as an array or as the
 * name of a destination in the document's name tree.
 */
function readLinksFromDoc(doc: PDFDocument): PdfLink[] {
  const links: PdfLink[] = [];

  const pages = doc.getPages();

  pages.forEach((page, pageIndex) => {
    const pageHeight = page.getHeight();
    const annots = resolve(doc, page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) return;

    for (const entry of annots.asArray()) {
      const dict = resolve(doc, entry);
      if (!(dict instanceof PDFDict)) continue;
      if (readSubtype(doc, dict) !== 'Link') continue;

      const rect = readNumbers(doc, dict, 'Rect');
      if (rect.length < 4) continue;

      const x = Math.min(rect[0]!, rect[2]!);
      const width = Math.abs(rect[2]! - rect[0]!);
      const height = Math.abs(rect[3]! - rect[1]!);
      const topInPdf = Math.min(rect[1]!, rect[3]!);

      // The action of the link: an address, or a jump into the document.
      const action = resolve(doc, dict.get(PDFName.of('A')));
      let url: string | undefined;
      let target: { pageIndex: number; top?: number } | null = null;

      if (action instanceof PDFDict) {
        const kind = readName(doc, action, 'S');
        if (kind === 'URI') {
          url = readText(doc, action, 'URI');
        } else if (kind === 'GoTo') {
          target = resolveDestination(doc, resolve(doc, action.get(PDFName.of('D'))));
        }
      }

      if (!target) {
        const dest = dict.get(PDFName.of('Dest'));
        if (dest !== undefined) target = resolveDestination(doc, dest);
      }

      links.push({
        id: readText(doc, dict, 'NM') || `lnk-${pageIndex}-${links.length}`,
        pageIndex,
        kind: url ? 'external' : 'internal',
        rect: { x, y: pageHeight - topInPdf - height, width, height },
        url,
        targetPageIndex: target?.pageIndex,
        targetY: target?.top,
      });
    }
  });

  return links;
}

/**
 * Read the bookmarks (the document outline) of an already loaded document.
 *
 * The outline is a tree of dictionaries that are chained through /Next and
 * /Prev, with the children of an item held in its own /First and /Last.
 * Every item points at a destination, which may be written in the three
 * forms {@link resolveDestination} understands.
 */
function readBookmarksFromDoc(doc: PDFDocument): PdfBookmark[] {
  const root = resolve(doc, doc.catalog.get(PDFName.of('Outlines')));
  if (!(root instanceof PDFDict)) return [];

  /** The dictionary of a key, or null when it is absent. */
  const dictAt = (node: PDFDict, key: string): PDFDict | null => {
    const raw = resolve(doc, node.get(PDFName.of(key)));
    return raw instanceof PDFDict ? raw : null;
  };

  /** The siblings of an item, in order. */
  const siblings = (first: PDFDict | null): PDFDict[] => {
    const out: PDFDict[] = [];
    let cursor = first;
    // The bound guards against a cycle in a malformed file.
    while (cursor && out.length < 10_000) {
      out.push(cursor);
      cursor = dictAt(cursor, 'Next');
    }
    return out;
  };

  /** The destination an item points at. */
  const destinationOf = (node: PDFDict): { pageIndex: number; top?: number } | null => {
    const dest = node.get(PDFName.of('Dest'));
    if (dest !== undefined) {
      const resolved = resolveDestination(doc, dest);
      if (resolved) return resolved;
    }
    const action = resolve(doc, node.get(PDFName.of('A')));
    if (action instanceof PDFDict && readName(doc, action, 'S') === 'GoTo') {
      return resolveDestination(doc, resolve(doc, action.get(PDFName.of('D'))));
    }
    return null;
  };

  let counter = 0;

  const readLevel = (items: PDFDict[], depth: number): PdfBookmark[] => {
    if (depth > 16) return [];
    const out: PdfBookmark[] = [];

    for (const item of items) {
      const title = readText(doc, item, 'Title');
      if (!title) continue;

      const destination = destinationOf(item);
      counter += 1;

      const bookmark: PdfBookmark = {
        id: `bmk-${counter}`,
        title,
        // A bookmark without a destination points at the first page, which
        // is what a reader does with it as well.
        pageIndex: destination?.pageIndex ?? 0,
        top: destination?.top,
      };

      const children = siblings(dictAt(item, 'First'));
      if (children.length > 0) {
        const nested = readLevel(children, depth + 1);
        if (nested.length > 0) bookmark.children = nested;
      }

      out.push(bookmark);
    }

    return out;
  };

  return readLevel(siblings(dictAt(root, 'First')), 0);
}

/**
 * Read the page labels of an already loaded document.
 *
 * The labels are a number tree in the catalog: an array of pairs, where the
 * number is the index of the first page of a range and the dictionary
 * beside it says how the pages of that range are numbered.
 */
function readPageLabelsFromDoc(doc: PDFDocument): PageLabelRange[] {
  const tree = resolve(doc, doc.catalog.get(PDFName.of('PageLabels')));
  if (!(tree instanceof PDFDict)) return [];

  const nums = resolve(doc, tree.get(PDFName.of('Nums')));
  if (!(nums instanceof PDFArray)) return [];

  const ranges: PageLabelRange[] = [];
  const entries = nums.asArray();

  for (let i = 0; i + 1 < entries.length; i += 2) {
    const index = resolve(doc, entries[i]);
    const spec = resolve(doc, entries[i + 1]);
    if (!(index instanceof PDFNumber) || !(spec instanceof PDFDict)) continue;

    const style = readName(doc, spec, 'S');
    const first = resolve(doc, spec.get(PDFName.of('St')));
    const prefix = readText(doc, spec, 'P');

    ranges.push({
      startPage: index.asNumber(),
      style: (['D', 'R', 'r', 'A', 'a'] as const).includes(style as PageLabelStyle)
        ? (style as PageLabelStyle)
        : 'D',
      first: first instanceof PDFNumber ? first.asNumber() : 1,
      prefix: prefix || undefined,
    });
  }

  return ranges;
}

/**
 * Read the page transitions of an already loaded document.
 */
function readPageTransitionsFromDoc(doc: PDFDocument): PageTransition[] {
  const transitions: PageTransition[] = [];

  doc.getPages().forEach((page, pageIndex) => {
    const trans = resolve(doc, page.node.get(PDFName.of('Trans')));
    if (!(trans instanceof PDFDict)) return;

    const style = readName(doc, trans, 'S');
    const duration = resolve(doc, trans.get(PDFName.of('D')));

    transitions.push({
      pageIndex,
      style: (['Split', 'Blinds', 'Box', 'Wipe', 'Dissolve', 'Glitter', 'Fly', 'Push', 'Cover', 'Uncover', 'Fade'] as const).includes(
        style as PageTransitionStyle,
      )
        ? (style as PageTransitionStyle)
        : 'Fade',
      duration: duration instanceof PDFNumber ? duration.asNumber() : 1,
    });
  });

  return transitions;
}

/**
 * Read the page boxes of an already loaded document.
 *
 * The margins are measured inward from the media box, which is the way
 * the print dialog of a reader shows them.
 */
function readPageBoxesFromDoc(doc: PDFDocument): PageBoxSettings[] {
  const boxes: PageBoxSettings[] = [];

  doc.getPages().forEach((page, pageIndex) => {
    const media = readBox(page.node, 'MediaBox') ?? [0, 0, 612, 792];

    for (const kind of ['CropBox', 'TrimBox', 'BleedBox', 'ArtBox'] as const) {
      const box = readBox(page.node, kind);
      if (!box) continue;

      const left = box[0] - media[0];
      const bottom = box[1] - media[1];
      const right = media[2] - box[2];
      const top = media[3] - box[3];
      if (left <= 0 && bottom <= 0 && right <= 0 && top <= 0) continue;

      boxes.push({ pageIndex, box: kind, left, bottom, right, top });
    }
  });

  return boxes;
}

/** The four numbers of a rectangle entry of a page. */
function readBox(node: PDFDict, key: string): [number, number, number, number] | null {
  const raw = node.get(PDFName.of(key));
  const array = raw instanceof PDFRef ? undefined : raw;
  if (!(array instanceof PDFArray)) return null;

  const values: number[] = [];
  for (const entry of array.asArray()) {
    if (entry instanceof PDFNumber) values.push(entry.asNumber());
  }
  if (values.length < 4) return null;

  return [
    Math.min(values[0]!, values[2]!),
    Math.min(values[1]!, values[3]!),
    Math.max(values[0]!, values[2]!),
    Math.max(values[1]!, values[3]!),
  ];
}

/**
 * Walk a name tree of the catalog.
 *
 * A name tree holds its entries either in a flat array of name and value
 * pairs or in the children it points at. Both are walked here, so the
 * layers and the embedded files of a document are found wherever they are.
 */
function walkNameTree(
  doc: PDFDocument,
  tree: PDFDict,
  visit: (name: string, value: PDFDict) => void,
  depth = 0,
): void {
  if (depth > 16) return;

  const names = resolve(doc, tree.get(PDFName.of('Names')));
  if (names instanceof PDFArray) {
    const entries = names.asArray();
    for (let i = 0; i + 1 < entries.length; i += 2) {
      const key = resolve(doc, entries[i]);
      const value = resolve(doc, entries[i + 1]);
      if (!(value instanceof PDFDict)) continue;
      const text =
        key instanceof PDFName || key instanceof PDFString || key instanceof PDFHexString
          ? key.decodeText()
          : '';
      if (text) visit(text, value);
    }
  }

  const kids = resolve(doc, tree.get(PDFName.of('Kids')));
  if (kids instanceof PDFArray) {
    for (const kid of kids.asArray()) {
      const child = resolve(doc, kid);
      if (child instanceof PDFDict) walkNameTree(doc, child, visit, depth + 1);
    }
  }
}

/**
 * Read the optional content groups (the layers) of a document.
 *
 * A layer is turned off by being named in the /OFF list of the default
 * configuration, so the state of a layer is read from there.
 */
function readLayersFromDoc(doc: PDFDocument): PdfLayer[] {
  const properties = resolve(doc, doc.catalog.get(PDFName.of('OCProperties')));
  if (!(properties instanceof PDFDict)) return [];

  const groups = resolve(doc, properties.get(PDFName.of('OCGs')));
  if (!(groups instanceof PDFArray)) return [];

  const configuration = resolve(doc, properties.get(PDFName.of('D')));
  const offRefs = new Set<string>();
  const onRefs = new Set<string>();

  if (configuration instanceof PDFDict) {
    const off = resolve(doc, configuration.get(PDFName.of('OFF')));
    if (off instanceof PDFArray) {
      for (const entry of off.asArray()) {
        if (entry instanceof PDFRef) offRefs.add(entry.toString());
      }
    }
    const on = resolve(doc, configuration.get(PDFName.of('ON')));
    if (on instanceof PDFArray) {
      for (const entry of on.asArray()) {
        if (entry instanceof PDFRef) onRefs.add(entry.toString());
      }
    }
  }

  // The pages a layer appears on, found through the resources of the pages.
  const pagesByLayer = new Map<string, number[]>();
  doc.getPages().forEach((page, pageIndex) => {
    const resources = page.node.Resources();
    if (!resources) return;
    const props = resolve(doc, resources.get(PDFName.of('Properties')));
    if (!(props instanceof PDFDict)) return;
    for (const [, value] of props.entries()) {
      if (!(value instanceof PDFRef)) continue;
      const key = value.toString();
      const list = pagesByLayer.get(key) ?? [];
      list.push(pageIndex);
      pagesByLayer.set(key, list);
    }
  });

  const layers: PdfLayer[] = [];
  groups.asArray().forEach((entry, index) => {
    if (!(entry instanceof PDFRef)) return;
    const group = resolve(doc, entry);
    if (!(group instanceof PDFDict)) return;

    const name = readText(doc, group, 'Name');
    layers.push({
      id: entry.toString(),
      name: name || `Katman ${index + 1}`,
      visible: !offRefs.has(entry.toString()),
      locked: onRefs.has(entry.toString()),
      pageIndexes: pagesByLayer.get(entry.toString()) ?? [],
    });
  });

  return layers;
}

/**
 * Read the embedded files of a document.
 */
function readAttachmentsFromDoc(doc: PDFDocument): PdfAttachment[] {
  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  if (!(names instanceof PDFDict)) return [];

  const tree = resolve(doc, names.get(PDFName.of('EmbeddedFiles')));
  if (!(tree instanceof PDFDict)) return [];

  const attachments: PdfAttachment[] = [];

  walkNameTree(doc, tree, (name, spec) => {
    const description = readText(doc, spec, 'Desc');
    const embedded = resolve(doc, spec.get(PDFName.of('EF')));
    const fileStream =
      embedded instanceof PDFDict
        ? resolve(doc, embedded.get(PDFName.of('F'))) ?? resolve(doc, embedded.get(PDFName.of('UF')))
        : undefined;

    let size = 0;
    let mimeType = '';
    const stream = fileStream instanceof PDFRawStream ? fileStream : undefined;
    if (stream) {
      const length = resolve(doc, stream.dict.get(PDFName.of('Length')));
      size = length instanceof PDFNumber ? length.asNumber() : 0;
      const subtype = resolve(doc, stream.dict.get(PDFName.of('Subtype')));
      if (subtype instanceof PDFName) mimeType = subtype.asString().replace(/^\//, '');
    }

    attachments.push({
      id: name,
      name: name,
      description: description || undefined,
      size,
      mimeType: mimeType || 'application/octet-stream',
    });
  });

  return attachments;
}

/** Read the hyperlinks of a document. */
export async function readLinks(data: ArrayBuffer | Uint8Array): Promise<PdfLink[]> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return readLinksFromDoc(doc);
  } catch {
    return [];
  }
}

/** Read the layers of a document. */
export async function readLayers(data: ArrayBuffer | Uint8Array): Promise<PdfLayer[]> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return readLayersFromDoc(doc);
  } catch {
    return [];
  }
}

/** Read the embedded files of a document. */
export async function readAttachments(data: ArrayBuffer | Uint8Array): Promise<PdfAttachment[]> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return readAttachmentsFromDoc(doc);
  } catch {
    return [];
  }
}

/**
 * Read the bytes of an embedded file.
 *
 * The file is looked up by its name in the name tree of the document and
 * its stream is decoded, so the file can be written out as it is.
 */
export async function readAttachmentBytes(
  data: ArrayBuffer | Uint8Array,
  name: string,
): Promise<Uint8Array | null> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return null;
  }

  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  if (!(names instanceof PDFDict)) return null;
  const tree = resolve(doc, names.get(PDFName.of('EmbeddedFiles')));
  if (!(tree instanceof PDFDict)) return null;

  let found: Uint8Array | null = null;

  walkNameTree(doc, tree, (entryName, spec) => {
    if (found || entryName !== name) return;
    const embedded = resolve(doc, spec.get(PDFName.of('EF')));
    if (!(embedded instanceof PDFDict)) return;
    const stream =
      resolve(doc, embedded.get(PDFName.of('F'))) ?? resolve(doc, embedded.get(PDFName.of('UF')));
    if (!(stream instanceof PDFRawStream)) return;
    try {
      found = decodePDFRawStream(stream).decode();
    } catch {
      found = null;
    }
  });

  return found;
}

/** Read the bookmarks of a document. */
export async function readBookmarks(data: ArrayBuffer | Uint8Array): Promise<PdfBookmark[]> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return readBookmarksFromDoc(doc);
  } catch {
    return [];
  }
}

/** Read the interactive form fields of an already loaded document. */
function readFormFieldsFromDoc(doc: PDFDocument): FormFieldInfo[] {
  let fields: PDFField[];
  try {
    fields = doc.getForm().getFields();
  } catch {
    return [];
  }

  // Page references, so a field can be pointed at the page it sits on.
  const pageIndexByRef = new Map<string, number>();
  doc.getPages().forEach((page, index) => {
    pageIndexByRef.set(page.ref.toString(), index);
  });

  const out: FormFieldInfo[] = [];

  for (const field of fields) {
    let name = '';
    try {
      name = field.getName();
    } catch {
      continue;
    }
    if (!name) continue;

    let kind: FormFieldKind = 'text';
    let value: FormFieldValue = '';
    let options: string[] = [];
    let multiline = false;

    try {
      if (field instanceof PDFTextField) {
        kind = 'text';
        value = field.getText() ?? '';
        multiline = field.isMultiline();
      } else if (field instanceof PDFCheckBox) {
        kind = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFRadioGroup) {
        kind = 'radio';
        value = field.getSelected() ?? '';
        options = field.getOptions();
      } else if (field instanceof PDFDropdown) {
        kind = 'dropdown';
        const selected = field.getSelected();
        value = selected && selected.length > 0 ? selected[0]! : '';
        options = field.getOptions();
      } else if (field instanceof PDFOptionList) {
        kind = 'listbox';
        value = field.getSelected() ?? [];
        options = field.getOptions();
      } else {
        kind = 'button';
        value = '';
      }
    } catch {
      // A field with an unreadable value is still worth listing.
      kind = 'text';
      value = '';
    }

    let pageIndex = -1;
    try {
      const widgets = field.acroField.getWidgets();
      const first = widgets[0];
      if (first) {
        const pageRef = first.dict.get(PDFName.of('P'));
        if (pageRef instanceof PDFRef) {
          pageIndex = pageIndexByRef.get(pageRef.toString()) ?? -1;
        }
      }
    } catch {
      // Leave the page unknown.
    }

    let readOnly = false;
    let required = false;
    try {
      readOnly = field.isReadOnly();
      required = field.isRequired();
    } catch {
      // Keep the defaults.
    }

    out.push({ name, kind, value, options, readOnly, required, multiline, pageIndex });
  }

  return out;
}

/**
 * Read everything the panels need from a document, in one pass.
 *
 * Loading a PDF is the expensive part, so the comments and the form fields
 * are read from the same parsed document rather than from two.
 */
export async function readDocumentFeatures(
  data: ArrayBuffer | Uint8Array,
): Promise<{
  comments: PdfComment[];
  fields: FormFieldInfo[];
  links: PdfLink[];
  bookmarks: PdfBookmark[];
  pageLabels: PageLabelRange[];
  pageTransitions: PageTransition[];
  pageBoxes: PageBoxSettings[];
  layers: PdfLayer[];
  attachments: PdfAttachment[];
}> {
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    return {
      comments: readCommentsFromDoc(doc),
      fields: readFormFieldsFromDoc(doc),
      links: readLinksFromDoc(doc),
      bookmarks: readBookmarksFromDoc(doc),
      pageLabels: readPageLabelsFromDoc(doc),
      pageTransitions: readPageTransitionsFromDoc(doc),
      pageBoxes: readPageBoxesFromDoc(doc),
      layers: readLayersFromDoc(doc),
      attachments: readAttachmentsFromDoc(doc),
    };
  } catch {
    // A file that cannot be parsed simply has no comments and no form.
    return {
      comments: [],
      fields: [],
      links: [],
      bookmarks: [],
      pageLabels: [],
      pageTransitions: [],
      pageBoxes: [],
      layers: [],
      attachments: [],
    };
  }
}

/**
 * Look at what a document carries that the user may want removed.
 *
 * The scanner only counts; it never changes anything. Every category it
 * reports maps to an option of the document inspector, so the report and
 * the removal list cannot drift apart.
 */
export async function scanDocument(data: ArrayBuffer | Uint8Array): Promise<SanitizeFinding[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return [];
  }

  const findings: SanitizeFinding[] = [];

  const metadataParts: string[] = [];
  const readMeta = (read: () => string | undefined) => {
    try {
      const value = read();
      if (value && value.trim()) metadataParts.push(value.trim());
    } catch {
      // A malformed entry is not worth reporting.
    }
  };
  readMeta(() => doc.getTitle());
  readMeta(() => doc.getAuthor());
  readMeta(() => doc.getSubject());
  readMeta(() => doc.getKeywords());
  readMeta(() => doc.getProducer());
  readMeta(() => doc.getCreator());
  if (metadataParts.length > 0) {
    findings.push({
      category: 'metadata',
      detail: metadataParts.join(' · '),
      count: metadataParts.length,
    });
  }

  const xmp = resolve(doc, doc.catalog.get(PDFName.of('Metadata')));
  if (xmp) {
    findings.push({ category: 'xmp', detail: 'XMP meta veri akışı', count: 1 });
  }

  let attachmentCount = 0;
  let javascriptCount = 0;
  let linkCount = 0;
  let formFieldCount = 0;
  let commentCount = 0;

  const pages = doc.getPages();
  for (const page of pages) {
    const annots = resolve(doc, page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) continue;
    for (const entry of annots.asArray()) {
      const dict = resolve(doc, entry);
      if (!(dict instanceof PDFDict)) continue;
      const subtype = readSubtype(doc, dict);
      if (subtype === 'Link') linkCount += 1;
      else if (subtype === 'FileAttachment') attachmentCount += 1;
      else if (subtype === 'Widget') formFieldCount += 1;
      else if (COMMENT_SUBTYPES[subtype]) commentCount += 1;
    }
  }

  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  if (names instanceof PDFDict) {
    const embedded = resolve(doc, names.get(PDFName.of('EmbeddedFiles')));
    if (embedded) attachmentCount += 1;
    const javascript = resolve(doc, names.get(PDFName.of('JavaScript')));
    if (javascript) javascriptCount += 1;
  }
  const openAction = resolve(doc, doc.catalog.get(PDFName.of('OpenAction')));
  if (openAction instanceof PDFDict) javascriptCount += 1;
  const additionalActions = resolve(doc, doc.catalog.get(PDFName.of('AA')));
  if (additionalActions instanceof PDFDict) javascriptCount += 1;

  if (attachmentCount > 0) {
    findings.push({ category: 'attachments', detail: 'Gömülü dosyalar', count: attachmentCount });
  }
  if (javascriptCount > 0) {
    findings.push({ category: 'javascript', detail: 'Betikler ve otomatik eylemler', count: javascriptCount });
  }
  if (linkCount > 0) {
    findings.push({ category: 'links', detail: 'Köprüler', count: linkCount });
  }
  if (formFieldCount > 0) {
    findings.push({ category: 'formFields', detail: 'Etkileşimli form alanları', count: formFieldCount });
  }
  if (commentCount > 0) {
    findings.push({ category: 'comments', detail: 'Yorumlar ve notlar', count: commentCount });
  }

  return findings;
}

/** The rectangle a note icon occupies, in the app's top-left page space. */
export function noteIconRect(anchor: { x: number; y: number }): PdfRect {
  const size = 20;
  return { x: anchor.x - size / 2, y: anchor.y - size / 2, width: size, height: size };
}
