import { describe, it, expect } from 'vitest';
import { toWinAnsi } from '../utils/pdfExport';

describe('toWinAnsi', () => {
  it('leaves plain ASCII untouched', () => {
    expect(toWinAnsi('Merhaba Dunya 123')).toBe('Merhaba Dunya 123');
  });

  it('preserves the Turkish letters WinAnsi can encode', () => {
    // Latin-1 covers ç Ç ö Ö ü Ü, so folding them to ASCII corrupted Turkish
    // words in the exported document's own text layer for no reason.
    expect(toWinAnsi('güzel örnek çözüm')).toBe('güzel örnek çözüm');
    expect(toWinAnsi('Ürün Özeti')).toBe('Ürün Özeti');
  });

  it('transliterates the Turkish letters WinAnsi cannot encode', () => {
    // ğ Ğ ş Ş ı İ sit above U+00FF and have no slot in the standard-14 fonts,
    // so they become their nearest ASCII rather than vanishing mid-word.
    // ç and ö are Latin-1 and survive each of these.
    expect(toWinAnsi('Şirket')).toBe('Sirket');
    expect(toWinAnsi('Ağaç')).toBe('Agaç');
    expect(toWinAnsi('ılık')).toBe('ilik');
    expect(toWinAnsi('İstanbul')).toBe('Istanbul');
    expect(toWinAnsi('Şemsi Paşa Pasajında Çarşıda Ağaç Öğretmen İlkokul ılık')).toBe(
      'Semsi Pasa Pasajinda Çarsida Agaç Ögretmen Ilkokul ilik',
    );
  });

  it('normalises typographic punctuation to ASCII equivalents', () => {
    expect(toWinAnsi('“quoted”')).toBe('"quoted"');
    expect(toWinAnsi('it’s')).toBe("it's");
    expect(toWinAnsi('a – b — c')).toBe('a - b - c');
    expect(toWinAnsi('wait…')).toBe('wait...');
    expect(toWinAnsi('a b')).toBe('a b');
  });

  it('preserves other accented Latin letters', () => {
    expect(toWinAnsi('café')).toBe('café');
    expect(toWinAnsi('naïve résumé')).toBe('naïve résumé');
  });

  it('strips characters WinAnsi cannot encode', () => {
    expect(toWinAnsi('emoji 🎉 gone')).toBe('emoji  gone');
    expect(toWinAnsi('CJK 中 gone')).toBe('CJK  gone');
    expect(toWinAnsi('Hello 🚀 World ★')).toBe('Hello  World ');
  });

  it('returns an empty string for empty input', () => {
    expect(toWinAnsi('')).toBe('');
  });

  it('never leaves a hole where a character was removed', () => {
    // A dropped glyph would silently run words together, so every removal has
    // to leave the surrounding spacing intact.
    expect(toWinAnsi('a ★ b')).toBe('a  b');
  });
});
