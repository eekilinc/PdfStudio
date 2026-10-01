import { describe, it, expect, beforeEach } from 'vitest';
import { nextAnnotationId, __resetAnnotationIdCounter } from '../utils/ids';

describe('nextAnnotationId', () => {
  beforeEach(() => {
    __resetAnnotationIdCounter();
  });

  it('produces a different id on every call', () => {
    // Regression guard: Math.random() ids could collide, and the old
    // `edit-${item.id}` scheme collided by construction.
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      ids.add(nextAnnotationId('ann'));
    }
    expect(ids.size).toBe(10_000);
  });

  it('keeps the prefix so the origin stays readable', () => {
    expect(nextAnnotationId('sig')).toMatch(/^sig-/);
    expect(nextAnnotationId('redact')).toMatch(/^redact-/);
  });

  it('contains only characters that are safe in an id', () => {
    // The counter is base-36, so digits appear once it passes nine.
    for (let i = 0; i < 200; i += 1) {
      expect(nextAnnotationId('t')).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('does not depend on wall-clock or random state', () => {
    // Deterministic on purpose, so ids are reproducible across runs and tests.
    expect(nextAnnotationId('ann')).toBe('ann-1');
    expect(nextAnnotationId('ann')).toBe('ann-2');
  });
});
