import { describe, expect, it } from 'vitest';
import { LEVELS, MISS_PENALTY } from '../src/config';
import { DEMO_SONGS } from '../src/data/demoSongs';
import { validateSongs } from '../src/data/validate';

describe('DEMO_SONGS (Phase 1 test data)', () => {
  it('passes the same validation the app runs on load', () => {
    expect(validateSongs(DEMO_SONGS)).toEqual([]);
  });

  it('has 6 songs per level with numeric levels 1-5', () => {
    for (const level of LEVELS) {
      expect(DEMO_SONGS.filter((s) => s.level === level)).toHaveLength(6);
    }
    expect(DEMO_SONGS.every((s) => typeof s.level === 'number')).toBe(true);
  });

  it('keeps every song below the 10B fail penalty and views as whole numbers', () => {
    expect(DEMO_SONGS.every((s) => Number.isInteger(s.exactViews) && s.exactViews < MISS_PENALTY)).toBe(true);
  });

  it('gets cheaper as the level gets harder', () => {
    const minOf = (level: number) => Math.min(...DEMO_SONGS.filter((s) => s.level === level).map((s) => s.exactViews));
    const maxOf = (level: number) => Math.max(...DEMO_SONGS.filter((s) => s.level === level).map((s) => s.exactViews));
    for (const level of [1, 2, 3, 4]) expect(minOf(level)).toBeGreaterThan(maxOf(level + 1));
  });
});
