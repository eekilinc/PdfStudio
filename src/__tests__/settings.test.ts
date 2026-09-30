import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from '../types/settings';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('settings management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return DEFAULT_SETTINGS when nothing is stored', () => {
    const settings = loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should save and load custom settings', () => {
    const customSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      theme: 'light',
      defaultZoom: 1.5,
      defaultPenColor: '#3b82f6',
    };

    saveSettings(customSettings);
    const loaded = loadSettings();

    expect(loaded.theme).toBe('light');
    expect(loaded.defaultZoom).toBe(1.5);
    expect(loaded.defaultPenColor).toBe('#3b82f6');
  });

  it('should fallback to defaults if json parse fails', () => {
    localStorage.setItem('pdfstudio_user_settings', 'invalid-json-string');
    const loaded = loadSettings();
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });
});
