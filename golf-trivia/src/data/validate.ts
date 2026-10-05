import { LEVELS, MISS_PENALTY } from '../config';
import { formatViews } from '../format';
import type { Song } from '../types';
import { parseVideoId } from '../youtube';
import { songKey } from './songKey';

/** Data problems that would break scoring. An empty list means the song list is safe to play. */
export function validateSongs(songs: readonly Song[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const song of songs) {
    const name = song.songName;
    if (!Number.isSafeInteger(song.exactViews) || song.exactViews < 0) {
      issues.push(`${name}: views must be a whole number, got ${song.exactViews}`);
    } else if (song.exactViews >= MISS_PENALTY) {
      issues.push(
        `${name}: ${formatViews(song.exactViews)} views is not below the ${formatViews(MISS_PENALTY)} fail penalty`,
      );
    }
    if (!(LEVELS as readonly number[]).includes(song.level)) {
      issues.push(`${name}: level must be 1-5, got ${song.level}`);
    }
    if (!parseVideoId(song.embedUrl)) {
      issues.push(`${name}: no playable embed URL`);
    }
    const key = songKey(name);
    if (seen.has(key)) issues.push(`${name}: duplicate song`);
    seen.add(key);
  }
  return issues;
}
