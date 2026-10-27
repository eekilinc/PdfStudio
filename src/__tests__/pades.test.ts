import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { checkPades } from '../utils/pades';

async function buildDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.setTitle('İmzalanacak Belge');
  return await doc.save();
}

describe('PAdES', () => {
  it('reports what the document still needs to carry a signature', async () => {
    const source = await buildDocument();
    const report = await checkPades(source);

    const rules = report.findings.map((f) => f.rule);
    expect(rules).toContain('signature-field');
    expect(rules).toContain('certificate');
    expect(rules).toContain('timestamp');
    expect(report.signatureFieldCount).toBe(0);
    expect(report.hasSignature).toBe(false);
    expect(report.isEncrypted).toBe(false);
  });
});
