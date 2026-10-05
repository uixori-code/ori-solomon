import type { Song } from '../types';
import { DEMO_SONGS } from './demoSongs';

/** True while the game runs on the built-in test songs and the single sample video. */
export const IS_TEST_DATA = true;

/**
 * The one place the game gets its songs from. Phase 2 replaces the body with the
 * Supabase `songs_trivia` loader; nothing else in the app needs to change.
 */
export async function loadSongs(): Promise<Song[]> {
  return DEMO_SONGS;
}
