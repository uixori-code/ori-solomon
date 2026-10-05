import { LEVELS, MISS_PENALTY } from '../config';
import { formatViews } from '../format';
import type { Song } from '../types';
import { parseVideoId } from '../youtube';

/** Reasons a single song can't be played safely. An empty list means it is fine. */
export function songProblems(song: Song): string[] {
  const problems: string[] = [];
  if (!Number.isSafeInteger(song.exactViews) || song.exactViews < 0) {
    problems.push(`${song.songName}: views must be a whole number, got ${song.exactViews}`);
  } else if (song.exactViews >= MISS_PENALTY) {
    problems.push(
      `${song.songName}: ${formatViews(song.exactViews)} views is not below the ${formatViews(MISS_PENALTY)} fail penalty`,
    );
  }
  if (!(LEVELS as readonly number[]).includes(song.level)) {
    problems.push(`${song.songName}: level must be 1-5, got ${song.level}`);
  }
  if (!parseVideoId(song.embedUrl)) {
    problems.push(`${song.songName}: no playable embed URL`);
  }
  return problems;
}

/**
 * Data problems that would break scoring across a whole song list. An empty list means it is safe to play.
 * (The same song appearing in two categories is not a problem: the game never plays a song name twice.)
 */
export function validateSongs(songs: readonly Song[]): string[] {
  return songs.flatMap(songProblems);
}
