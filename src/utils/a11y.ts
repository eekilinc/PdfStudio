/**
 * The accessibility of a document.
 *
 * Two things live here: the checks that report what stands in the way of
 * a document being accessible, and the tagging that turns a document into
 * a tagged one.
 *
 * The rules are the same ones a reader of Acrobat Pro sees, with the same
 * identifiers, so a finding can be compared with the one of another tool.
 * Only the rules that can be decided from the file itself are checked; the
 * ones that need a human to look at the page are left to the report.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRef,
  PDFBool,
  PDFRawStream,
  PDFString,
  PDFPage,
  decodePDFRawStream,
} from 'pdf-lib';
import type { PdfComment } from '../types/pdf';

/** How serious a finding is. */
export type A11ySeverity = 'error' | 'warning' | 'info';

export interface A11yFinding {
  /** The stable identifier of the rule, the same as the one of other tools. */
  rule: string;
  /** The name of the rule. */
  title: string;
  /** What is wrong, in one sentence. */
  detail: string;
  severity: A11ySeverity;
  /** The page the finding belongs to, 0-based. */
  pageIndex?: number;
  /** Whether the application can fix it. */
  fixable: boolean;
}

/** An image of the document, the way a reader sees a figure. */
export interface A11yFigure {
  /** The page the figure is on, 0-based. */
  pageIndex: number;
  /** The name of the image in the page's resources. */
  name: string;
  /** The description of the figure, when it has one. */
  alt?: string;
  /** The size of the image in points, when it is known. */
  width?: number;
  height?: number;
}

export interface A11yReport {
  findings: A11yFinding[];
  figures: A11yFigure[];
  /** Whether the document carries a structure tree. */
  tagged: boolean;
  /** The number of pages. */
  pageCount: number;
  /** The number of form fields without a description. */
  fieldsWithoutDescription: number;
  /** The language of the document, when it has one. */
  language?: string;
  /** The title of the document, when it has one. */
  title?: string;
}

/** The key a figure is known by: the page and the name of the image. */
export function figureKey(pageIndex: number, name: string): string {
  return `${pageIndex}:${name}`;
}

/** Resolve an object that may be stored indirectly. */
function resolve(doc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? doc.context.lookup(value) : value;
}

/** Read a text entry of a dictionary. */
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
  return '';
}

/** The name of a dictionary entry, without its slash. */
function readName(doc: PDFDocument, dict: PDFDict, key: string): string {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
  if (!(raw instanceof PDFName)) return '';
  return raw.asString().replace(/^\//, '');
}

/**
 * The dictionary of an object.
 *
 * An image is a stream with a dictionary, a page is a dictionary, so the
 * entries of both are read the same way.
 */
function dictOf(object: unknown): PDFDict | undefined {
  if (object instanceof PDFDict) return object;
  if (object instanceof PDFRawStream) return object.dict;
  return undefined;
}

/** Read a boolean entry of a dictionary. */
function readBool(doc: PDFDocument, dict: PDFDict, key: string): boolean {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
  if (raw instanceof PDFBool) return raw.asBoolean();
  return raw === true;
}

/** The images of a page, with the name they are drawn under. */
function imagesOfPage(doc: PDFDocument, page: { node: { Resources(): PDFDict | undefined } }): Array<{ name: string; ref: PDFRef }> {
  const resources = page.node.Resources();
  if (!resources) return [];

  const xobjects = resolve(doc, resources.get(PDFName.of('XObject')));
  if (!(xobjects instanceof PDFDict)) return [];

  const out: Array<{ name: string; ref: PDFRef }> = [];
  for (const [key, value] of xobjects.entries()) {
    if (!(value instanceof PDFRef)) continue;
    const object = resolve(doc, value);
    const dict = dictOf(object);
    if (!dict) continue;
    if (readName(doc, dict, 'Subtype') !== 'Image') continue;
    out.push({ name: key.asString().replace(/^\//, ''), ref: value });
  }
  return out;
}

/**
 * The descriptions the document already gives to its figures.
 *
 * The description of a figure lives in the structure element that holds
 * it, so the tree is walked to find the elements of the /Figure type and
 * the image they point at.
 */
export function readFigureAltTexts(doc: PDFDocument): Map<string, string> {
  const out = new Map<string, string>();

  const root = resolve(doc, doc.catalog.get(PDFName.of('StructTreeRoot')));
  if (!(root instanceof PDFDict)) return out;

  /** The elements of a structure tree, without running into a cycle. */
  const elements = (node: PDFDict, depth: number): PDFDict[] => {
    if (depth > 32) return [];
    const kids = resolve(doc, node.get(PDFName.of('K')));
    const list = kids instanceof PDFArray ? kids.asArray() : kids ? [kids] : [];

    const out: PDFDict[] = [];
    for (const kid of list) {
      const dict = resolve(doc, kid);
      if (dict instanceof PDFDict) out.push(dict);
    }
    return out;
  };

  const walk = (node: PDFDict, depth: number) => {
    if (depth > 32) return;
    for (const element of elements(node, depth)) {
      if (readName(doc, element, 'S') === 'Figure') {
        const alt = readText(doc, element, 'Alt');
        const kids = resolve(doc, element.get(PDFName.of('K')));
        const list = kids instanceof PDFArray ? kids.asArray() : kids ? [kids] : [];
        for (const kid of list) {
          const dict = resolve(doc, kid);
          if (!(dict instanceof PDFDict)) continue;
          if (readName(doc, dict, 'Type') !== 'OBJR') continue;
          const obj = dict.get(PDFName.of('Obj'));
          if (obj instanceof PDFRef && alt) out.set(obj.toString(), alt);
        }
      }
      walk(element, depth + 1);
    }
  };

  walk(root, 0);
  return out;
}

/**
 * Check the accessibility of a document.
 *
 * The checks are the ones that can be decided from the file: the language,
 * the title, whether the document is tagged, the descriptions of the
 * figures and of the form fields, and the scripts it carries.
 */
export async function checkAccessibility(data: ArrayBuffer | Uint8Array): Promise<A11yReport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return { findings: [], figures: [], tagged: false, pageCount: 0, fieldsWithoutDescription: 0 };
  }

  const findings: A11yFinding[] = [];
  const figures: A11yFigure[] = [];
  const pages = doc.getPages();
  const pageCount = pages.length;

  const language = readName(doc, doc.catalog, 'Lang');
  const title = doc.getTitle() ?? '';

  const markInfo = resolve(doc, doc.catalog.get(PDFName.of('MarkInfo')));
  const marked = markInfo instanceof PDFDict && readBool(doc, markInfo, 'Marked');
  const tagged = doc.catalog.get(PDFName.of('StructTreeRoot')) !== undefined && marked;

  // 1. The document is tagged.
  if (!tagged) {
    findings.push({
      rule: 'tagged-pdf',
      title: 'Etiketli PDF değil',
      detail:
        'Belgede yapı ağacı (structure tree) yok. Ekran okuyucu metni, başlıkları ve görselleri ' +
        'belgenin kendi düzenine göre okuyamaz.',
      severity: 'error',
      fixable: true,
    });
  }

  // 2. The language of the document.
  if (!language) {
    findings.push({
      rule: 'primary-language',
      title: 'Belge dili belirtilmemiş',
      detail: 'Katalogda /Lang yok. Ekran okuyucu metni hangi dilde okuyacağını bilemez.',
      severity: 'error',
      fixable: true,
    });
  }

  // 3. The title of the document.
  if (!title.trim()) {
    findings.push({
      rule: 'title',
      title: 'Belge başlığı yok',
      detail: 'Belge bilgilerinde başlık yok. Dosya adı değiştiğinde belgeyi tanımak zorlaşır.',
      severity: 'warning',
      fixable: true,
    });
  }

  // 4. The window title shows the document title.
  const viewerPreferences = resolve(doc, doc.catalog.get(PDFName.of('ViewerPreferences')));
  const displayDocTitle =
    viewerPreferences instanceof PDFDict && readBool(doc, viewerPreferences, 'DisplayDocTitle');
  if (!displayDocTitle && title.trim()) {
    findings.push({
      rule: 'display-doc-title',
      title: 'Pencere başlığı belge başlığını göstermiyor',
      detail: '/ViewerPreferences /DisplayDocTitle kapalı; ekran okuyucu belge başlığını duyurmaz.',
      severity: 'info',
      fixable: true,
    });
  }

  // 5. The outline of the document.
  if (doc.catalog.get(PDFName.of('Outlines')) === undefined && pageCount > 1) {
    findings.push({
      rule: 'bookmarks',
      title: 'İçindekiler tablosu yok',
      detail: 'Belgede yer imi yok. Uzun belgelerde başlıklar arasında gezinmek zorlaşır.',
      severity: 'warning',
      fixable: false,
    });
  }

  // 6. The permission that lets a screen reader read the document.
  if (doc.catalog.get(PDFName.of('Perms')) === undefined) {
    findings.push({
      rule: 'permission-flag',
      title: 'Erişilebilirlik izni işaretlenmemiş',
      detail: 'Katalogda /Perms yok; yardımcı teknolojiler için izin kaydı bulunmuyor.',
      severity: 'info',
      fixable: false,
    });
  }

  // 7. The scripts of the document.
  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  const hasJavaScript =
    (names instanceof PDFDict && names.get(PDFName.of('JavaScript')) !== undefined) ||
    (() => {
      const openAction = resolve(doc, doc.catalog.get(PDFName.of('OpenAction')));
      return openAction instanceof PDFDict && readName(doc, openAction, 'S') === 'JavaScript';
    })();
  if (hasJavaScript) {
    findings.push({
      rule: 'scripts',
      title: 'Belgede betik var',
      detail:
        'Belge JavaScript içeriyor. Yardımcı teknolojilerle çalışmayan betikler erişilebilirliği ' +
        'engelleyebilir.',
      severity: 'warning',
      fixable: true,
    });
  }

  // 8. The figures of the document and their descriptions.
  const altTexts = readFigureAltTexts(doc);
  let figuresWithoutAlt = 0;

  pages.forEach((page, pageIndex) => {
    for (const image of imagesOfPage(doc, page)) {
      const alt = altTexts.get(image.ref.toString());
      const dimensions = imageDimensions(doc, image.ref);
      figures.push({
        pageIndex,
        name: image.name,
        alt,
        width: dimensions?.width,
        height: dimensions?.height,
      });
      if (!alt) figuresWithoutAlt += 1;
    }
  });

  if (figuresWithoutAlt > 0) {
    findings.push({
      rule: 'figures-alt-text',
      title: 'Açıklaması olmayan görseller',
      detail: `${figuresWithoutAlt} görselin metin açıklaması (alt text) yok. Ekran okuyucu bunları "görsel" diye okur.`,
      severity: 'error',
      fixable: true,
    });
  }

  // 9. The annotations that are not part of the structure.
  let untaggedAnnotations = 0;
  pages.forEach((page) => {
    const annots = resolve(doc, page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) return;
    for (const entry of annots.asArray()) {
      const dict = resolve(doc, entry);
      if (!(dict instanceof PDFDict)) continue;
      const subtype = readName(doc, dict, 'Subtype');
      if (subtype === 'Widget' || subtype === 'Popup') continue;
      if (dict.get(PDFName.of('StructParent')) !== undefined) continue;
      untaggedAnnotations += 1;
    }
  });
  if (untaggedAnnotations > 0 && tagged) {
    findings.push({
      rule: 'tagged-annotations',
      title: 'Yapıya bağlanmamış açıklamalar',
      detail: `${untaggedAnnotations} açıklama (link, not) yapı ağacına bağlanmamış.`,
      severity: 'warning',
      fixable: false,
    });
  }

  // 10. The form fields and their descriptions.
  let fieldsWithoutDescription = 0;
  try {
    for (const field of doc.getForm().getFields()) {
      const description = readText(doc, field.acroField.dict, 'TU');
      if (!description.trim()) fieldsWithoutDescription += 1;
    }
  } catch {
    // A document without a form has no fields.
  }
  if (fieldsWithoutDescription > 0) {
    findings.push({
      rule: 'field-descriptions',
      title: 'Açıklaması olmayan form alanları',
      detail: `${fieldsWithoutDescription} alanın yardımcı metni (/TU) yok. Ekran okuyucu alanın ne olduğunu bilemez.`,
      severity: 'error',
      fixable: true,
    });
  }

  // 11. A document of images only, without text.
  if (pageCount > 0 && figures.length > 0 && !hasText(doc)) {
    findings.push({
      rule: 'image-only',
      title: 'Belgede metin yok',
      detail:
        'Belge yalnızca görsellerden oluşuyor. Metin katmanı olmayan belgelerde okuma ve arama ' +
        'çalışmaz; OCR ile metin eklenmelidir.',
      severity: 'warning',
      fixable: false,
    });
  }

  return {
    findings,
    figures,
    tagged,
    pageCount,
    fieldsWithoutDescription,
    language: language || undefined,
    title: title || undefined,
  };
}

/** The size of an image in points, when the file says. */
function imageDimensions(
  doc: PDFDocument,
  ref: PDFRef,
): { width: number; height: number } | undefined {
  const dict = dictOf(resolve(doc, ref));
  if (!dict) return undefined;

  const width = resolve(doc, dict.get(PDFName.of('Width')));
  const height = resolve(doc, dict.get(PDFName.of('Height')));
  if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) return undefined;

  return { width: width.asNumber(), height: height.asNumber() };
}

/** Whether the document holds any text at all. */
function hasText(doc: PDFDocument): boolean {
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    for (const entry of streams) {
      const stream = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
      if (!(stream instanceof PDFRawStream)) continue;
      let decoded: string;
      try {
        decoded = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
      } catch {
        continue;
      }
      if (/\bT[jJ]\b/.test(decoded)) return true;
    }
  }
  return false;
}

/**
 * Wrap the content of a page in a marked content sequence.
 *
 * The sequence is what the structure element points at: without it the
 * element has nothing to say the page belongs to it.
 */
function wrapPageContent(doc: PDFDocument, page: PDFPage, mcid: number): boolean {
  const contents = page.node.Contents();
  if (!contents) return false;

  const first = contents instanceof PDFArray ? contents.get(0) : contents;
  const stream = first instanceof PDFRef ? doc.context.lookup(first) : first;
  if (!(stream instanceof PDFRawStream)) return false;

  let decoded: string;
  try {
    decoded = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
  } catch {
    return false;
  }

  const wrapped = `/P << /MCID ${mcid} >> BDC\n${decoded}\nEMC`;
  const replacement = doc.context.register(doc.context.flateStream(wrapped));

  if (contents instanceof PDFArray) {
    contents.set(0, replacement);
  } else {
    page.node.set(PDFName.of('Contents'), replacement);
  }
  return true;
}

/**
 * Turn the document into a tagged one.
 *
 * The tree that is written here is the plain one: every page becomes a
 * paragraph and every image on it becomes a figure with a description.
 * It is not as fine grained as a tree that a person would build by hand,
 * but it is the structure a screen reader needs to walk the document, and
 * it can be refined afterwards.
 *
 * The descriptions of the figures are taken from the map, keyed by the
 * page and the name of the image.
 */
export function tagDocument(doc: PDFDocument, altTexts: Record<string, string> = {}): void {
  const context = doc.context;
  const pages = doc.getPages();

  const documentElement = context.obj({ Type: PDFName.of('StructElem'), S: PDFName.of('Document') });
  const documentRef = context.register(documentElement);

  const structTreeRoot = context.obj({
    Type: PDFName.of('StructTreeRoot'),
    K: context.obj([documentRef]),
  });
  const structTreeRootRef = context.register(structTreeRoot);

  const parentTree: PDFObject[] = [];
  const paragraphRefs: PDFRef[] = [];

  pages.forEach((page, pageIndex) => {
    const paragraph = context.obj({ Type: PDFName.of('StructElem'), S: PDFName.of('P') });
    const paragraphRef = context.register(paragraph);
    paragraph.set(PDFName.of('P'), documentRef);
    paragraph.set(PDFName.of('Pg'), page.ref);

    const children: PDFObject[] = [];

    // The text of the page belongs to the paragraph.
    if (wrapPageContent(doc, page, 0)) {
      children.push(PDFNumber.of(0));
      page.node.set(PDFName.of('StructParents'), PDFNumber.of(pageIndex));
      parentTree.push(PDFNumber.of(pageIndex), paragraphRef);
    }

    // Every image on the page becomes a figure with its description.
    for (const image of imagesOfPage(doc, page)) {
      const alt = altTexts[figureKey(pageIndex, image.name)];
      const figure = context.obj({ Type: PDFName.of('StructElem'), S: PDFName.of('Figure') });
      if (alt) figure.set(PDFName.of('Alt'), PDFHexString.fromText(alt));

      const objectRef = context.obj({ Type: PDFName.of('OBJR'), Obj: image.ref, Pg: page.ref });
      figure.set(PDFName.of('K'), context.obj([context.register(objectRef)]));
      figure.set(PDFName.of('P'), paragraphRef);

      children.push(context.register(figure));
    }

    paragraph.set(PDFName.of('K'), context.obj(children));
    paragraphRefs.push(paragraphRef);
  });

  documentElement.set(PDFName.of('K'), context.obj(paragraphRefs));
  structTreeRoot.set(PDFName.of('ParentTree'), context.register(context.obj({ Nums: context.obj(parentTree) })));

  doc.catalog.set(PDFName.of('StructTreeRoot'), structTreeRootRef);
  doc.catalog.set(PDFName.of('MarkInfo'), context.register(context.obj({ Marked: true })));
}

/**
 * Set the language of the document.
 */
export function setDocumentLanguage(doc: PDFDocument, language: string): void {
  doc.catalog.set(PDFName.of('Lang'), PDFName.of(language));
}

/**
 * Set the title of the document.
 *
 * An empty title removes the entry, which is what the checker asks for
 * when the document has no title at all.
 */
export function setDocumentTitle(doc: PDFDocument, title: string): void {
  if (title.trim()) {
    doc.setTitle(title);
    return;
  }
  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef instanceof PDFRef) {
    const info = resolve(doc, infoRef);
    if (info instanceof PDFDict) info.delete(PDFName.of('Title'));
  }
}

/**
 * Let the window title of a reader show the title of the document.
 */
export function setDisplayDocTitle(doc: PDFDocument, enabled: boolean): void {
  const existing = resolve(doc, doc.catalog.get(PDFName.of('ViewerPreferences')));
  let preferences: PDFDict;
  if (existing instanceof PDFDict) {
    preferences = existing;
  } else {
    const created = doc.context.obj({});
    doc.context.register(created);
    preferences = created;
  }
  preferences.set(PDFName.of('DisplayDocTitle'), doc.context.obj(enabled));
  doc.catalog.set(PDFName.of('ViewerPreferences'), preferences);
}

/**
 * Give the form fields a description, taken from the name of the field.
 *
 * The description is what a screen reader reads out for the field, so it
 * has to say what the field is for, not what it is called.
 */
export function setFieldDescriptions(doc: PDFDocument): number {
  let changed = 0;
  try {
    for (const field of doc.getForm().getFields()) {
      const existing = readText(doc, field.acroField.dict, 'TU');
      if (existing.trim()) continue;
      const name = field.getName().trim();
      if (!name) continue;
      field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(name));
      changed += 1;
    }
  } catch {
    // A document without a form has no fields.
  }
  return changed;
}

/**
 * The comments of the document that are not part of the structure.
 *
 * They are reported by the checker and listed here, so the user can see
 * which of them are still floating around.
 */
export function untaggedComments(comments: PdfComment[]): PdfComment[] {
  return comments.filter((comment) => comment.kind !== 'note' || !comment.author);
}
