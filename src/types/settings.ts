import type { ReaderFilter } from './pdf';

export interface AppSettings {
  // 1. Appearance & Theme
  theme: 'dark' | 'light';
  readerFilter: ReaderFilter;
  defaultZoom: number; // 0.75, 1.0, 1.25, 1.5
  sidebarDefaultOpen: boolean;

  // 2. Default Annotations & Tools
  defaultPenColor: string;
  defaultPenWidth: number;
  defaultHighlighterColor: string;
  defaultHighlighterOpacity: number;
  defaultFontSize: number;
  defaultFontFamily: string;

  // 3. File & Save Preferences
  saveLocationMode: 'ask' | 'downloads';
  rememberRecentFiles: boolean;
  maxRecentFiles: number;
  showWelcomeScreenOnStartup: boolean;

  // 4. OCR & Engine
  defaultOcrLanguage: 'tur' | 'eng' | 'deu' | 'fra';

  // 5. Privacy
  /**
   * Whether the "send selected text to the translation service?" prompt may be
   * skipped. The prompt exists because translation is the only feature that
   * leaves the machine; a user who has read it can dismiss it for good.
   */
  confirmTextTranslation: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  readerFilter: 'normal',
  defaultZoom: 1.0,
  sidebarDefaultOpen: true,

  defaultPenColor: '#ef4444',
  defaultPenWidth: 3,
  defaultHighlighterColor: '#fde047',
  defaultHighlighterOpacity: 0.4,
  defaultFontSize: 16,
  defaultFontFamily: 'Inter, sans-serif',

  saveLocationMode: 'ask',
  rememberRecentFiles: true,
  maxRecentFiles: 8,
  showWelcomeScreenOnStartup: true,

  defaultOcrLanguage: 'tur',

  // On by default: the prompt is the only thing standing between a document
  // fragment and a third-party host.
  confirmTextTranslation: true,
};

const SETTINGS_STORAGE_KEY = 'pdfstudio_user_settings';

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
  }
}
