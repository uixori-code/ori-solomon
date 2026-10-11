import { describe, expect, it } from 'vitest';
import { DEMO_SONGS } from '../src/data/demoSongs';
import { rowsToSongs } from '../src/data/supabaseSongs';
import { buildSongIndexHtml } from '../src/host/songIndex';
import type { Song } from '../src/types';

const mk = (number: number, songName: string, over: Partial<Song> = {}): Song => ({
  id: String(number),
  number,
  songName,
  level: 1,
  exactViews: 1_234_567_890,
  embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ...over,
});

describe('song numbers', () => {
  it('test songs are numbered 1..30, each once', () => {
    expect(DEMO_SONGS.map((s) => s.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
  it('real songs take their number from the permanent row id', () => {
    const { songs } = rowsToSongs([
      { id: 137, category: 'Pop', region: 'Foreign', level: 1, artist_and_song: 'A - B', exact_views: 5, embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    ]);
    expect(songs[0].number).toBe(137);
  });
  it('a row whose id is not a positive whole number is left out and reported', () => {
    const { songs, problems } = rowsToSongs([
      { id: 'abc', category: 'Pop', region: 'Foreign', level: 1, artist_and_song: 'A - B', exact_views: 5, embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    ]);
    expect(songs).toEqual([]);
    expect(problems[0]).toMatch(/no song number/);
  });
});

describe('buildSongIndexHtml', () => {
  it('lists every song once, sorted by number, with its title, views and level', () => {
    const html = buildSongIndexHtml([mk(30, 'Zed - Last'), mk(2, 'Alpha - First', { category: 'Rock_Metal', region: 'Israeli', level: 4 })], '1 Jan');
    expect(html.indexOf('Alpha - First')).toBeLessThan(html.indexOf('Zed - Last'));
    expect(html.match(/<tr><td class="n">/g)).toHaveLength(2);
    expect(html).toContain('1,234,567,890');
    expect(html).toContain('Rock &amp; Metal');
    expect(html).toContain('2 songs');
  });
  it('escapes HTML and keeps Hebrew', () => {
    const html = buildSongIndexHtml([mk(1, '<script>alert(1)</script> שיר "x"')], 'today');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; שיר &quot;x&quot;');
    expect(html).toContain('dir="auto"');
  });
  it('covers all 30 test songs', () => {
    expect(buildSongIndexHtml(DEMO_SONGS, 'today').match(/<tr><td class="n">/g)).toHaveLength(30);
  });
});
