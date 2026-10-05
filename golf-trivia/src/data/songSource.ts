import type { Song } from '../types';
import { DEMO_SONGS } from './demoSongs';
import { fetchSupabaseSongs } from './supabaseSongs';

export interface LoadedSongs {
  songs: Song[];
  /** True while the built-in test songs (one sample video) are in use. */
  isTest: boolean;
  /** Something the host should know, e.g. why the test songs are showing. */
  notice: string | null;
  /** Songs that were left out because they can't be played safely. */
  problems: string[];
}

const testSongs = (notice: string | null, problems: string[] = []): LoadedSongs => ({
  songs: DEMO_SONGS,
  isTest: true,
  notice,
  problems,
});

/**
 * The one place the game gets its songs from. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set it reads
 * `songs_trivia` (only songs that already have a video); otherwise it runs on the built-in test songs.
 */
export async function loadSongs(): Promise<LoadedSongs> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return testSongs(null);

  try {
    const { songs, problems } = await fetchSupabaseSongs(url, key);
    if (songs.length === 0) {
      return testSongs(
        'Supabase has no songs with a video yet. Run scripts/fill-embed-urls.mjs, then reload. Showing the test songs for now.',
        problems,
      );
    }
    return { songs, isTest: false, notice: null, problems };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return testSongs(`Couldn't load songs from Supabase (${reason}). Showing the test songs.`);
  }
}
