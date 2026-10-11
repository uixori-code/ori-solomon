import type { LEVELS } from './config';

export type Level = (typeof LEVELS)[number];

export interface Team {
  id: number;
  name: string;
  totalViewsScore: number;
}

export interface Song {
  id: string;
  /** Permanent number shown on screen instead of the title; the host's list maps it to the song. */
  number: number;
  songName: string;
  level: Level;
  /** Whole number of views. Never rounded. */
  exactViews: number;
  embedUrl: string;
  /** e.g. "Rock_Metal", "Pop". Absent on the built-in test songs. */
  category?: string;
  /** "Foreign" or "Israeli". Absent on the built-in test songs. */
  region?: string;
  /** Second the music really starts (skips a silent intro). Clips play from here. 0 = from the beginning. */
  startSec?: number;
}

export interface ActiveSong {
  song: Song;
  /** Wrong guesses made so far on this song. */
  wrongGuesses: number;
  /** Longest clip played on this song, in seconds. 0 means nothing played yet. */
  maxListenSec: number;
  /** Epoch ms of the first listen, null until then. Drives the countdown. */
  startedAt: number | null;
  /** True once the host showed the genre/region hint (costs HINT_SURCHARGE_PCT). */
  hintUsed: boolean;
}

export type Outcome = 'solved' | 'failed' | 'timeout' | 'passed';

export interface HistoryEntry {
  id: number;
  round: number;
  teamId: number;
  teamName: string;
  songNumber: number;
  songName: string;
  level: Level;
  exactViews: number;
  outcome: Outcome;
  /** Guesses used, including the correct one. */
  guessesUsed: number;
  listenSeconds: number;
  listenPct: number;
  wrongPct: number;
  listenAmount: number;
  wrongAmount: number;
  capped: boolean;
  hintPct: number;
  hintAmount: number;
  /** Streak discount in percent, and the (positive) number of views it took off. */
  streakPct: number;
  streakAmount: number;
  pointsAdded: number;
}
