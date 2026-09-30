import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_NAME, GITHUB_REPO_URL } from '../version';

describe('Application Version Metadata', () => {
  it('should have valid semver format for APP_VERSION', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have expected APP_NAME and GITHUB_REPO_URL', () => {
    expect(APP_NAME).toBe('PDF Studio Pro');
    expect(GITHUB_REPO_URL).toBe('https://github.com/eekilinc/pdfstudio');
  });
});
