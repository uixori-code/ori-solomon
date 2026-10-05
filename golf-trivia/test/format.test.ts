import { describe, expect, it } from 'vitest';
import { formatClock, formatDelta, formatViews, formatViewsCompact } from '../src/format';
import { parseVideoId } from '../src/youtube';

describe('formatViews', () => {
  it('adds thousands separators', () => {
    expect(formatViews(1234567890)).toBe('1,234,567,890');
    expect(formatViews(589450123)).toBe('589,450,123');
    expect(formatViews(10_000_000_000)).toBe('10,000,000,000');
    expect(formatViews(0)).toBe('0');
  });
  it('compact form', () => {
    expect(formatViewsCompact(1234567890)).toBe('1.23B');
    expect(formatViewsCompact(589450123)).toBe('589M');
    expect(formatViewsCompact(10_000_000_000)).toBe('10B');
  });
  it('delta and clock', () => {
    expect(formatDelta(104_000_000)).toBe('+104,000,000');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(9.2)).toBe('0:10');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('parseVideoId', () => {
  it('reads embed, watch and short URLs', () => {
    expect(parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for a search-results link (the sheet\'s current links)', () => {
    expect(parseVideoId('https://www.youtube.com/results?search_query=Eminem+Lose+Yourself')).toBeNull();
  });
});
