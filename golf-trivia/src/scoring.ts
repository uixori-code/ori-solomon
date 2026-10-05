import {
  CAP_AT_MISS_PENALTY,
  LISTEN_SURCHARGE_PCT,
  MAX_GUESSES,
  MISS_PENALTY,
  WRONG_GUESS_PCT,
  isListenStep,
} from './config';

export interface ScoreInput {
  exactViews: number;
  /** Longest clip played on the song: 1, 2, 4, 8 or 16. */
  listenSeconds: number;
  /** Wrong guesses made before this correct one (0, 1 or 2). */
  wrongGuessesBefore: number;
}

export interface ScoreBreakdown {
  base: number;
  listenPct: number;
  wrongPct: number;
  listenAmount: number;
  wrongAmount: number;
  /** base + listenAmount + wrongAmount, before the cap. */
  uncapped: number;
  /** What is actually added to the team's total. */
  total: number;
  capped: boolean;
}

/**
 * Score for a correct guess. Listen % and wrong-guess % add up on the base views.
 * The base is never changed; only the surcharge is rounded to a whole view, and the
 * two surcharge rows always add up exactly to the combined, rounded surcharge.
 */
export function getScoreBreakdown(input: ScoreInput): ScoreBreakdown {
  const { exactViews, listenSeconds, wrongGuessesBefore } = input;
  if (!Number.isSafeInteger(exactViews) || exactViews < 0) {
    throw new RangeError(`exactViews must be a non-negative whole number, got ${exactViews}`);
  }
  if (!isListenStep(listenSeconds)) {
    throw new RangeError(`listenSeconds must be one of 1, 2, 4, 8, 16, got ${listenSeconds}`);
  }
  if (!Number.isInteger(wrongGuessesBefore) || wrongGuessesBefore < 0 || wrongGuessesBefore >= MAX_GUESSES) {
    throw new RangeError(`wrongGuessesBefore must be 0..${MAX_GUESSES - 1}, got ${wrongGuessesBefore}`);
  }

  const listenPct = LISTEN_SURCHARGE_PCT[listenSeconds];
  const wrongPct = WRONG_GUESS_PCT * wrongGuessesBefore;
  const surcharge = Math.round((exactViews * (listenPct + wrongPct)) / 100);
  const wrongAmount = Math.round((exactViews * wrongPct) / 100);
  const listenAmount = surcharge - wrongAmount;
  const uncapped = exactViews + surcharge;
  const capped = CAP_AT_MISS_PENALTY && uncapped > MISS_PENALTY;

  return {
    base: exactViews,
    listenPct,
    wrongPct,
    listenAmount,
    wrongAmount,
    uncapped,
    total: capped ? MISS_PENALTY : uncapped,
    capped,
  };
}

export const calculateGuessScore = (input: ScoreInput): number => getScoreBreakdown(input).total;

/** Surcharge percentages only, for the live "cost if correct now" line (never reveals the views). */
export function surchargePercents(listenSeconds: number, wrongGuesses: number) {
  const listenPct = isListenStep(listenSeconds) ? LISTEN_SURCHARGE_PCT[listenSeconds] : 0;
  const wrongPct = WRONG_GUESS_PCT * wrongGuesses;
  return { listenPct, wrongPct, totalPct: listenPct + wrongPct };
}
