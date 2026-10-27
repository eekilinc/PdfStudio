/**
 * PDF/A: what the document still needs to be an archival file.
 *
 * The checks are the ones that can be decided from the file itself. The
 * conversion writes what the application can write: the XMP metadata that
 * names the part and the conformance level, the identifier of the file and
 * the title. What it cannot write — the colour profile of the output
 * intent — is reported as still missing, so the report never claims more
 * than the file really holds.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from 'pdf-lib';

export type PdfaSeverity = 'error' | 'warning' | 'info';

export interface PdfaFinding {
  /** The stable identifier of the rule. */
  rule: string;
  title: string;
  detail: string;
  severity: PdfaSeverity;
  /** Whether the application can write what is missing. */
  fixable: boolean;
}

export interface PdfaReport {
  findings: PdfaFinding[];
  /** The part and the conformance the document claims in its metadata. */
  declared?: { part: string; conformance: string };
  /** Whether the document carries XMP metadata at all. */
  hasMetadata: boolean;
}

/** The part and the conformance the application writes. */
export interface PdfaTarget {
  part: string;
  conformance: string;
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
  // A name, such as the name of a font, carries its text as well.
  if (raw instanceof PDFName) return raw.decodeText();
  return '';
}

/** The XMP metadata of the document, when it has one. */
function metadataOf(doc: PDFDocument): string {
  const metadata = resolve(doc, doc.catalog.get(PDFName.of('Metadata')));
  if (!(metadata instanceof PDFRawStream)) return '';
  try {
    return new TextDecoder('utf-8').decode(metadata.contents);
  } catch {
    return '';
  }
}

/**
 * The name of a font, without the marks a producer adds to it.
 *
 * A subset carries a six letter tag in front of its name and a producer
 * may add a number behind it; neither says anything about the font.
 */
function normalizeFontName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '').replace(/-\d{6,}$/, '');
}

/** The fourteen fonts of the standard, which need no embedding. */
const STANDARD_FONTS = new Set([
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Symbol',
  'ZapfDingbats',
]);

/**
 * Check what the document still needs to be an archival file.
 */
export async function checkPdfA(data: ArrayBuffer | Uint8Array): Promise<PdfaReport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return { findings: [], hasMetadata: false };
  }

  const findings: PdfaFinding[] = [];
  const xmp = metadataOf(doc);
  const hasMetadata = xmp.length > 0;

  // 1. The part and the conformance the document claims.
  const part = /<pdfaid:part>\s*(\d+)\s*<\/pdfaid:part>/.exec(xmp)?.[1];
  const conformance = /<pdfaid:conformance>\s*([A-Za-z]+)\s*<\/pdfaid:conformance>/.exec(xmp)?.[1];

  if (!part) {
    findings.push({
      rule: 'xmp-metadata',
      title: 'PDF/A bildirimi (XMP) yok',
      detail:
        'Belgenin XMP meta verisi içinde pdfaid:part ve pdfaid:conformance değerleri yok. ' +
        'PDF/A uyumlu bir dosya bu iki değeri taşımak zorundadır.',
      severity: 'error',
      fixable: true,
    });
  }

  // 2. The colour profile of the output intent.
  const outputIntents = resolve(doc, doc.catalog.get(PDFName.of('OutputIntents')));
  let hasOutputIntent = false;
  if (outputIntents instanceof PDFArray) {
    for (const entry of outputIntents.asArray()) {
      const intent = resolve(doc, entry);
      if (!(intent instanceof PDFDict)) continue;
      const profile = resolve(doc, intent.get(PDFName.of('DestOutputProfile')));
      if (profile) hasOutputIntent = true;
    }
  }
  if (!hasOutputIntent) {
    findings.push({
      rule: 'output-intent',
      title: 'Çıktı amacı (ICC profili) yok',
      detail:
        'Katalogda /OutputIntents yok. PDF/A dosyaları renkleri sabitleyen bir ICC profili ' +
        'taşımak zorundadır; uygulama profili kendisi üretemez, bu adım elle yapılmalıdır.',
      severity: 'error',
      fixable: false,
    });
  }

  // 3. The fonts of the document have to be embedded.
  const missingFonts = new Set<string>();
  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const fonts = resolve(doc, resources.get(PDFName.of('Font')));
    if (!(fonts instanceof PDFDict)) continue;

    for (const [name, value] of fonts.entries()) {
      const font = resolve(doc, value);
      if (!(font instanceof PDFDict)) continue;

      // A font that is one of the fourteen standard ones needs no embedding.
      const base = normalizeFontName(readText(doc, font, 'BaseFont'));
      if (STANDARD_FONTS.has(base)) {
        continue;
      }

      const descriptor = resolve(doc, font.get(PDFName.of('FontDescriptor')));
      if (!(descriptor instanceof PDFDict)) {
        missingFonts.add(name.asString().replace(/^\//, ''));
        continue;
      }
      const embedded =
        descriptor.get(PDFName.of('FontFile')) !== undefined ||
        descriptor.get(PDFName.of('FontFile2')) !== undefined ||
        descriptor.get(PDFName.of('FontFile3')) !== undefined;
      if (!embedded) missingFonts.add(name.asString().replace(/^\//, ''));
    }
  }
  if (missingFonts.size > 0) {
    const names = Array.from(missingFonts);
    const listed = names.slice(0, 5).join(', ');
    findings.push({
      rule: 'embedded-fonts',
      title: 'Gömülmemiş yazı tipi var',
      detail:
        `${names.length} yazı tipi dosyaya gömülmemiş (${listed}${names.length > 5 ? '…' : ''}). ` +
        'PDF/A, kullanılan her yazı tipinin gömülü olmasını ister.',
      severity: 'error',
      fixable: false,
    });
  }

  // 4. The document carries no script.
  const names = resolve(doc, doc.catalog.get(PDFName.of('Names')));
  const hasJavaScript =
    (names instanceof PDFDict && names.get(PDFName.of('JavaScript')) !== undefined) ||
    (() => {
      const openAction = resolve(doc, doc.catalog.get(PDFName.of('OpenAction')));
      return (
        openAction instanceof PDFDict &&
        (resolve(doc, openAction.get(PDFName.of('S'))) as unknown) === PDFName.of('JavaScript')
      );
    })();
  if (hasJavaScript) {
    findings.push({
      rule: 'no-javascript',
      title: 'Belgede betik var',
      detail: 'PDF/A, belge düzeyinde JavaScript bulunmasına izin vermez.',
      severity: 'error',
      fixable: true,
    });
  }

  // 5. The file has an identifier.
  const id = doc.context.trailerInfo.ID;
  if (!id) {
    findings.push({
      rule: 'document-id',
      title: 'Dosya kimliği (trailer /ID) yok',
      detail: 'PDF/A dosyasında kalıcı bir dosya kimliği olmalıdır.',
      severity: 'warning',
      fixable: true,
    });
  }

  // 6. The document has a title.
  const title = doc.getTitle();
  if (!title || !title.trim()) {
    findings.push({
      rule: 'title',
      title: 'Belge başlığı yok',
      detail: 'PDF/A, belgenin XMP meta verisinde başlık ister.',
      severity: 'warning',
      fixable: true,
    });
  }

  // 7. The document is not encrypted.
  if (doc.isEncrypted) {
    findings.push({
      rule: 'no-encryption',
      title: 'Belge şifreli',
      detail: 'PDF/A dosyaları şifreli olamaz.',
      severity: 'error',
      fixable: false,
    });
  }

  return {
    findings,
    declared: part && conformance ? { part, conformance } : undefined,
    hasMetadata,
  };
}

/**
 * Write the XMP metadata that declares the document as PDF/A.
 *
 * The metadata also carries the title and the author, because the XMP
 * metadata is where an archival file keeps them.
 */
export function writePdfAMetadata(
  doc: PDFDocument,
  target: PdfaTarget,
  info: { title?: string; author?: string; subject?: string; keywords?: string },
): void {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const title = escape(info.title ?? doc.getTitle() ?? '');
  const author = escape(info.author ?? doc.getAuthor() ?? '');
  const subject = escape(info.subject ?? doc.getSubject() ?? '');
  const keywords = escape(info.keywords ?? '');

  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="PDF Studio Pro">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${escape(target.part)}</pdfaid:part>
      <pdfaid:conformance>${escape(target.conformance)}</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      ${author ? `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` : ''}
      ${subject ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${subject}</rdf:li></rdf:Alt></dc:description>` : ''}
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      ${keywords ? `<pdf:Keywords>${keywords}</pdf:Keywords>` : ''}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const stream = doc.context.stream(xmp, {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(stream));
}

/**
 * Give the file the identifier an archival file needs.
 */
export function writeDocumentId(doc: PDFDocument): void {
  if (doc.context.trailerInfo.ID) return;

  // The two parts of the identifier are the same value, which is what a
  // file that was never signed carries.
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const id = doc.context.obj([PDFString.of(seed), PDFString.of(seed)]);
  doc.context.trailerInfo.ID = id;
}
