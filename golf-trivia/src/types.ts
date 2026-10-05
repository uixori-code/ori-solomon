import type { LEVELS } from './config';

export type Level = (typeof LEVELS)[number];

export interface Team {
  id: number;
  name: string;
  totalViewsScore: number;
}

export interface Song {
  id: string;
  songName: string;
  level: Level;
  /** Whole number of views. Never rounded. */
  exactViews: number;
  embedUrl: string;
}

export interface ActiveSong {
  song: Song;
  /** Wrong guesses made so far on this song. */
  wrongGuesses: number;
  /** Longest clip played on this song, in seconds. 0 means nothing played yet. */
  maxListenSec: number;
  /** Epoch ms of the first listen, null until then. Drives the countdown. */
  startedAt: number | null;
}

export type Outcome = 'solved' | 'failed' | 'timeout';

export interface HistoryEntry {
  id: number;
  round: number;
  teamId: number;
  teamName: string;
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
  pointsAdded: number;
}
