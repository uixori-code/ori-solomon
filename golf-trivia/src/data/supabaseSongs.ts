import { createClient } from '@supabase/supabase-js';
import type { Level, Song } from '../types';
import { songProblems } from './validate';

/** A `songs_trivia` row as the game reads it. */
export interface SongRow {
  id: number | string;
  category: string | null;
  region: string | null;
  level: number;
  artist_and_song: string;
  exact_views: number | string | null;
  embed_url: string | null;
}

/** Turns table rows into playable songs. Rows that can't be played safely are dropped and reported. */
export function rowsToSongs(rows: readonly SongRow[]): { songs: Song[]; problems: string[] } {
  const songs: Song[] = [];
  const problems: string[] = [];
  for (const row of rows) {
    const song: Song = {
      id: String(row.id),
      songName: row.artist_and_song,
      level: row.level as Level,
      // Number(null) is 0, which would turn a row with no views into a free song: make it NaN so it is rejected.
      exactViews: row.exact_views === null || row.exact_views === '' ? Number.NaN : Number(row.exact_views),
      embedUrl: row.embed_url ?? '',
      category: row.category ?? undefined,
      region: row.region ?? undefined,
    };
    const issues = songProblems(song);
    if (issues.length) problems.push(...issues);
    else songs.push(song);
  }
  return { songs, problems };
}

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** Every song that has both a view count and a video. Songs without a video yet are simply not loaded. */
export async function fetchSupabaseSongs(url: string, anonKey: string) {
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const rows: SongRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('songs_trivia')
      .select('id, category, region, level, artist_and_song, exact_views, embed_url')
      .not('embed_url', 'is', null)
      .not('exact_views', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as SongRow[]));
    if (data.length < PAGE) break;
  }
  return rowsToSongs(rows);
}
