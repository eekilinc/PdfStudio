import { describe, it, expect } from 'vitest';
import { inferFontStyle } from '../utils/fontInference';

describe('inferFontStyle', () => {
  describe('does not invent a style from a stray letter', () => {
    // Regression guard. The old matcher tested for the bare characters "b" and
    // "i", so these names all came out bold or italic.
    it.each([
      'Arial',
      'Helvetica',
      'Calibri',
      'Times New Roman',
      'LiberationSans',
      'LiberationSerif',
      'DejaVuSans',
      'Bookman',
      'NotoSans',
      'MinionPro-Regular',
      'Segoe UI',
    ])('%s is neither bold nor italic', (name) => {
      const style = inferFontStyle(name);
      expect(style.fontWeight).toBe('normal');
      expect(style.fontStyle).toBe('normal');
    });
  });

  describe('detects explicit style tokens', () => {
    it('reads Arial-BoldMT', () => {
      const style = inferFontStyle('Arial-BoldMT');
      expect(style.fontWeight).toBe('bold');
      expect(style.fontStyle).toBe('normal');
    });

    it('reads Arial-ItalicMT', () => {
      const style = inferFontStyle('Arial-ItalicMT');
      expect(style.fontStyle).toBe('italic');
      expect(style.fontWeight).toBe('normal');
    });

    it('reads Arial-BoldItalicMT as both', () => {
      const style = inferFontStyle('Arial-BoldItalicMT');
      expect(style.fontWeight).toBe('bold');
      expect(style.fontStyle).toBe('italic');
    });

    it('reads the base-14 face names', () => {
      expect(inferFontStyle('Helvetica-Bold').fontWeight).toBe('bold');
      expect(inferFontStyle('Times-Italic').fontStyle).toBe('italic');
      expect(inferFontStyle('Courier-Oblique').fontStyle).toBe('italic');
    });

    it('reads Liberation family names', () => {
      expect(inferFontStyle('LiberationSans-Bold').fontWeight).toBe('bold');
      expect(inferFontStyle('LiberationSerif-Italic').fontStyle).toBe('italic');
    });

    it('reads underscore-separated names', () => {
      expect(inferFontStyle('Some_Font_Bold').fontWeight).toBe('bold');
    });
  });

  describe('handles TeX encodings', () => {
    it('treats cmbx as bold', () => {
      expect(inferFontStyle('cmbx10').fontWeight).toBe('bold');
    });

    it('treats cmti and cmmi as italic', () => {
      expect(inferFontStyle('cmti10').fontStyle).toBe('italic');
      expect(inferFontStyle('cmmi10').fontStyle).toBe('italic');
    });

    it('leaves upright cmr alone', () => {
      const style = inferFontStyle('cmr10');
      expect(style.fontWeight).toBe('normal');
      expect(style.fontStyle).toBe('normal');
    });
  });

  describe('strips the subset prefix', () => {
    it('still detects the style after a six-letter prefix', () => {
      const style = inferFontStyle('ABCDEF+Calibri-Bold');
      expect(style.fontWeight).toBe('bold');
    });

    it('does not let a prefix look like a style token', () => {
      // A subset prefix is six uppercase letters; it must not be read as one.
      const style = inferFontStyle('BBBBBB+Arial');
      expect(style.fontWeight).toBe('normal');
    });
  });

  describe('falls back safely', () => {
    it('returns the UI font for missing input', () => {
      for (const value of [undefined, null, '']) {
        const style = inferFontStyle(value);
        expect(style.fontWeight).toBe('normal');
        expect(style.fontStyle).toBe('normal');
        expect(style.fontFamily).toContain('Inter');
      }
    });

    it('returns the UI font for an unnamed glyph run', () => {
      // g_d0_f1 carries no style information; guessing a serif would misalign
      // the selection rectangles against the rendered glyphs.
      const style = inferFontStyle('g_d0_f1');
      expect(style.fontFamily).toContain('Inter');
    });
  });

  describe('family resolution', () => {
    it('maps serif families to a serif stack', () => {
      expect(inferFontStyle('Times New Roman').fontFamily).toContain('serif');
      expect(inferFontStyle('Cambria').fontFamily).toContain('serif');
    });

    it('maps monospace families to a mono stack', () => {
      expect(inferFontStyle('Courier').fontFamily).toContain('monospace');
      expect(inferFontStyle('Consolas').fontFamily).toContain('monospace');
    });

    it('maps sans families to a sans stack', () => {
      // Note: "sans-serif" itself contains the substring "serif", so the check
      // is for the serif *stack*, not for the letters.
      const family = inferFontStyle('Arial').fontFamily;
      expect(family).toContain('sans-serif');
      expect(family).not.toContain('Times New Roman');
      expect(family).not.toContain('Georgia');
    });

    it('prefers the specific match over the generic one', () => {
      // "Courier New" contains neither "serif" nor "sans" but is unambiguously mono.
      expect(inferFontStyle('Courier New').fontFamily).toContain('monospace');
    });
  });
});
