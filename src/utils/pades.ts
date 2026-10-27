/**
 * PAdES: what the document still needs to carry a digitally signed version.
 *
 * The checks are the ones that can be decided from the file itself. What the
 * application cannot do — produce a CMS/PKCS#7 signature, contact a
 * certificate authority or a time-stamping service — is reported as still
 * missing, so the report never claims more than the file really holds.
 *
 * Signing itself requires a native crypto stack (PKCS#12 / smart card / PKCS#11)
 * and is performed by the Tauri backend; the browser side only prepares the
 * signature field and the appearance.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
  PDFString,
} from 'pdf-lib';

export type PadesSeverity = 'error' | 'warning' | 'info';

export interface PadesFinding {
  /** The stable identifier of the rule. */
  rule: string;
  title: string;
  detail: string;
  severity: PadesSeverity;
  /** Whether the application can write what is missing. */
  fixable: boolean;
}

export interface PadesReport {
  findings: PadesFinding[];
  /** How many signature fields the document carries. */
  signatureFieldCount: number;
  /** Whether the document carries at least one embedded signature. */
  hasSignature: boolean;
  /** Whether the document is encrypted. */
  isEncrypted: boolean;
}

/** Resolve an object that may be stored indirectly. */
function resolve(doc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? doc.context.lookup(value) : value;
}

/** Read a text entry of a dictionary. */
function readText(doc: PDFDocument, dict: PDFDict, key: string): string {
  const raw = resolve(doc, dict.get(PDFName.of(key)));
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

/** Walk the AcroForm field tree and collect the signature fields. */
function collectSignatureFields(doc: PDFDocument): PDFDict[] {
  const result: PDFDict[] = [];
  const acroForm = resolve(doc, doc.catalog.get(PDFName.of('AcroForm')));
  if (!(acroForm instanceof PDFDict)) return result;

  const fields = resolve(doc, acroForm.get(PDFName.of('Fields')));
  if (!(fields instanceof PDFArray)) return result;

  const walk = (node: unknown) => {
    const dict = resolve(doc, node);
    if (!(dict instanceof PDFDict)) return;
    const ft = readText(doc, dict, 'FT');
    if (ft === 'Sig') result.push(dict);
    const kids = resolve(doc, dict.get(PDFName.of('Kids')));
    if (kids instanceof PDFArray) {
      for (const kid of kids.asArray()) walk(kid);
    }
  };

  for (const entry of fields.asArray()) walk(entry);
  return result;
}

/** Whether a signature field carries an actual /V signature. */
function hasEmbeddedSignature(field: PDFDict): boolean {
  const value = field.get(PDFName.of('V'));
  return value !== undefined;
}

/**
 * Check what the document still needs to carry a PAdES signature.
 */
export async function checkPades(data: ArrayBuffer | Uint8Array): Promise<PadesReport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch {
    return {
      findings: [],
      signatureFieldCount: 0,
      hasSignature: false,
      isEncrypted: false,
    };
  }

  const findings: PadesFinding[] = [];

  // 1. Encryption keeps a signature out of reach of the signer.
  const isEncrypted = doc.isEncrypted;
  if (isEncrypted) {
    findings.push({
      rule: 'encryption',
      title: 'Belge şifreli',
      detail:
        'Şifreli bir PDF\'e PAdES imzası eklemek için önce şifreyi kaldırmak gerekir. ' +
        'İmza, dosyanın bayt aralığını korumalıdır.',
      severity: 'error',
      fixable: false,
    });
  }

  // 2. Signature fields.
  const sigFields = collectSignatureFields(doc);
  const hasSignature = sigFields.some(hasEmbeddedSignature);

  if (sigFields.length === 0) {
    findings.push({
      rule: 'signature-field',
      title: 'İmza alanı yok',
      detail:
        'Belgede AcroForm içinde bir imza alanı (/FT /Sig) bulunamadı. ' +
        'PAdES imzası için önce bir imza alanı oluşturulmalıdır.',
      severity: 'warning',
      fixable: true,
    });
  }

  if (sigFields.length > 0 && !hasSignature) {
    findings.push({
      rule: 'unsigned-field',
      title: 'İmzalanmamış imza alanı',
      detail:
        `${sigFields.length} imza alanı var ama hiçbiri doldurulmamış. ` +
        'Bir sertifika ve anahtar ile /V sözlüğü doldurularak imza tamamlanmalıdır.',
      severity: 'info',
      fixable: true,
    });
  }

  // 3. A certificate chain is required for a real signature.
  findings.push({
    rule: 'certificate',
    title: 'Sertifika zinciri gerekli',
    detail:
      'PAdES imzası için bir X.509 sertifikası ve özel anahtar (PKCS#12 veya PKCS#11) gerekir. ' +
      'Uygulama bu anahtarı yerelde tutmaz; imzalama Tauri arka ucunda native bir crypto yığını ile yapılır.',
    severity: 'info',
    fixable: false,
  });

  // 4. A timestamp is required for long-term validity.
  findings.push({
    rule: 'timestamp',
    title: 'Zaman damgası gerekli',
    detail:
      'Uzun süreli geçerlilik (LTV) için bir RFC 3161 zaman damgası (TSA) alınmalıdır. ' +
      'Uygulama şu an bir TSA ile konuşmaz.',
    severity: 'info',
    fixable: false,
  });

  return {
    findings,
    signatureFieldCount: sigFields.length,
    hasSignature,
    isEncrypted,
  };
}
