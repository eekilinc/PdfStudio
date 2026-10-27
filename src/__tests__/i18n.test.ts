import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  t,
  tpl,
  tn,
  setLocale,
  getLocale,
  resolveLocale,
  formatFileSize,
  i18n,
} from '../utils/i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en');
  });

  afterEach(() => {
    setLocale('en');
  });

  it('returns English strings for the default locale', () => {
    expect(t('app.name')).toBe('PDF Studio Pro');
    expect(t('header.save')).toBe('Save');
    expect(t('welcome.subtitle')).toContain('offline');
  });

  it('returns Turkish strings when the Turkish locale is selected', () => {
    setLocale('tr');
    expect(t('app.name')).toBe('PDF Studio Pro');
    expect(t('header.save')).toBe('Kaydet');
    expect(t('welcome.subtitle')).toContain('çevrimdışı');
  });

  it('falls back to English for missing keys', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
    expect(t('app.name')).not.toBe('this.key.does.not.exist');
  });

  it('resolves known locale aliases', () => {
    expect(resolveLocale('tr')).toBe('tr');
    expect(resolveLocale('turkish')).toBe('tr');
    expect(resolveLocale('Türkçe')).toBe('tr');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('defaults to English when no locale is set', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(i18n.t('header.save')).toBe('Save');
  });

  it('substitutes placeholders', () => {
    expect(tpl('status.page', { page: 3, total: 9 })).toBe('Page 3 of 9');
    expect(tpl('status.page', { page: 3, total: 9 }, 'tr')).toBe('3 / 9');
    expect(tpl('comments.title', { count: 2 })).toBe('Comments (2)');
  });

  it('keeps pluralization simple and stable', () => {
    expect(tn('comments.title', 1)).toBe('Comments (1)');
    expect(tn('comments.title', 5)).toBe('Comments (5)');
  });

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatFileSize(1024 * 1024 * 1024 * 3)).toBe('3 GB');
  });
});
