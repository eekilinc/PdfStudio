import { describe, it, expect } from 'vitest';
import { toWinAnsi, hexToRgb } from '../utils/pdfExport';

describe('pdfExport utility functions', () => {
  describe('toWinAnsi', () => {
    it('should correctly replace Turkish characters with ASCII equivalents', () => {
      const input = 'Şemsi Paşa Pasajında Çarşıda Ağaç Öğretmen İlkokul ılık';
      const output = toWinAnsi(input);
      expect(output).toBe('Semsi Pasa Pasajinda Carsida Agac Ogretmen Ilkokul ilik');
    });

    it('should return empty string when input is empty or nullish', () => {
      expect(toWinAnsi('')).toBe('');
      // @ts-expect-error testing nullish handling
      expect(toWinAnsi(null)).toBe('');
    });

    it('should strip unsupported non-WinAnsi characters', () => {
      const input = 'Hello 🚀 World ★';
      const output = toWinAnsi(input);
      expect(output).toBe('Hello  World ');
    });
  });

  describe('hexToRgb', () => {
    it('should convert 6-character hex to normalized RGB values (0-1)', () => {
      const result = hexToRgb('#ff0000');
      expect(result).not.toBeNull();
      // pdf-lib rgb values are 0-1
      expect(result?.red).toBeCloseTo(1);
      expect(result?.green).toBeCloseTo(0);
      expect(result?.blue).toBeCloseTo(0);
    });

    it('should convert 3-character hex correctly', () => {
      const result = hexToRgb('#0f0');
      expect(result).not.toBeNull();
      expect(result?.red).toBeCloseTo(0);
      expect(result?.green).toBeCloseTo(1);
      expect(result?.blue).toBeCloseTo(0);
    });

    it('should return null for transparent or empty inputs', () => {
      expect(hexToRgb('transparent')).toBeNull();
      expect(hexToRgb('')).toBeNull();
    });

    it('should return black fallback for invalid length hex', () => {
      const result = hexToRgb('#invalid');
      expect(result).not.toBeNull();
      expect(result?.red).toBeCloseTo(0);
      expect(result?.green).toBeCloseTo(0);
      expect(result?.blue).toBeCloseTo(0);
    });
  });
});
