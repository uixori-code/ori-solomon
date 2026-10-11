// Every tunable game rule lives here.

/** Added to a team's total when a song is failed (3 wrong guesses or time-out). */
export const MISS_PENALTY = 10_000_000_000;

/** If true, a correct answer can never cost more than failing the song would. */
export const CAP_AT_MISS_PENALTY = true;

/** Each wrong guess on a song adds this many percent to the song's views. */
export const WRONG_GUESS_PCT = 15;

/** Guesses per team per song. */
export const MAX_GUESSES = 3;

/** Listening clip lengths, in seconds. */
export const LISTEN_STEPS = [1, 2, 4, 8, 16] as const;
export type ListenStep = (typeof LISTEN_STEPS)[number];

/** Percent added to the song's views for the longest clip played on it. 1 s is free. */
export const LISTEN_SURCHARGE_PCT: Record<ListenStep, number> = {
  1: 0,
  2: 2,
  4: 4,
  8: 8,
  16: 16,
};

export const isListenStep = (n: number): n is ListenStep =>
  (LISTEN_STEPS as readonly number[]).includes(n);

/** A hint (the song's genre and region) adds this many percent to the song's views. */
export const HINT_SURCHARGE_PCT = 10;

/** Passing on a song costs this many views; the song is revealed and the turn ends. */
export const PASS_PENALTY = 3_000_000_000;

/** Solving this many songs in a row on the first guess starts a streak... */
export const STREAK_NEEDED = 3;
/** ...and every first-guess solve that continues the streak is this many percent cheaper. */
export const STREAK_BONUS_PCT = 10;

export const LEVELS = [1, 2, 3, 4, 5] as const;

/** Seconds per song, counted from the first listen. 0 turns the timer off. */
export const SONG_TIME_LIMIT_SEC = 90;

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 3;
export const DEFAULT_TEAM_NAMES = ['Team A', 'Team B', 'Team C'];
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 15;
export const DEFAULT_ROUNDS = 5;

/** Placeholder video used by every test song in Phase 1. Swap for any embeddable video. */
export const SAMPLE_VIDEO_ID = 'dQw4w9WgXcQ';
