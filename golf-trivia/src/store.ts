import { create } from 'zustand';
import {
  DEFAULT_ROUNDS,
  DEFAULT_TEAM_NAMES,
  MAX_GUESSES,
  MAX_ROUNDS,
  MAX_TEAMS,
  MIN_ROUNDS,
  MIN_TEAMS,
  MISS_PENALTY,
  isListenStep,
} from './config';
import { songKey } from './data/songKey';
import { getScoreBreakdown } from './scoring';
import type { ActiveSong, HistoryEntry, Level, Outcome, Song, Team } from './types';

export type Phase = 'setup' | 'pickLevel' | 'listening' | 'revealed' | 'gameOver';

export interface SetupConfig {
  teamNames: string[];
  maxRounds: number;
}

/** What handleGuess did: ignored (stray click), wrong (song continues), solved, or failed (3rd wrong). */
export type GuessResult = 'ignored' | 'wrong' | 'solved' | 'failed';

export interface GameState {
  phase: Phase;
  songs: Song[];
  /** Normalised names of songs already drawn this game, so none repeats. */
  playedKeys: string[];
  setup: SetupConfig;
  teams: Team[];
  currentTeamIndex: number;
  /** 1-based. A round is one turn per team. */
  round: number;
  maxRounds: number;
  active: ActiveSong | null;
  lastResult: HistoryEntry | null;
  /** Revealed songs only, newest first. */
  history: HistoryEntry[];
  /** Drives the "+104,000,000" flash on the scoreboard. */
  scoreFlash: { teamId: number; amount: number; nonce: number } | null;
}

export interface GameActions {
  setSongs: (songs: Song[]) => void;
  startGame: (config: SetupConfig) => void;
  /** Draws a random unplayed song at this level. Returns false if none is left. */
  selectLevel: (level: Level) => boolean;
  /** Records that a clip of this length was played (the longest one sets the surcharge). */
  playClip: (seconds: number) => void;
  handleGuess: (teamId: number, isCorrect: boolean, songExactViews: number) => GuessResult;
  /** The song timer ran out. */
  failActiveSong: () => void;
  /** The video can't be played: swap in another song at the same level, no cost. */
  skipUnplayable: () => void;
  nextTurn: () => void;
  playAgain: () => void;
  newSetup: () => void;
}

export type GameStore = GameState & GameActions;

export function drawSong(
  songs: readonly Song[],
  playedKeys: readonly string[],
  level: Level,
  rng: () => number = Math.random,
): Song | null {
  const pool = songs.filter((s) => s.level === level && !playedKeys.includes(songKey(s.songName)));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

const initialState = (): GameState => ({
  phase: 'setup',
  songs: [],
  playedKeys: [],
  setup: { teamNames: DEFAULT_TEAM_NAMES.slice(0, MIN_TEAMS), maxRounds: DEFAULT_ROUNDS },
  teams: [],
  currentTeamIndex: 0,
  round: 1,
  maxRounds: DEFAULT_ROUNDS,
  active: null,
  lastResult: null,
  history: [],
  scoreFlash: null,
});

interface SettleDetail {
  guessesUsed: number;
  exactViews?: number;
  listenPct?: number;
  wrongPct?: number;
  listenAmount?: number;
  wrongAmount?: number;
  capped?: boolean;
}

export function createGameStore(rng: () => number = Math.random) {
  return create<GameStore>()((set, get) => {
    /** Adds the points to the current team, records the result and moves to the reveal. */
    const settle = (outcome: Outcome, pointsAdded: number, d: SettleDetail) => {
      const s = get();
      const active = s.active;
      const team = s.teams[s.currentTeamIndex];
      if (!active || !team) return;

      const entry: HistoryEntry = {
        id: s.history.length + 1,
        round: s.round,
        teamId: team.id,
        teamName: team.name,
        songName: active.song.songName,
        level: active.song.level,
        exactViews: d.exactViews ?? active.song.exactViews,
        outcome,
        guessesUsed: d.guessesUsed,
        listenSeconds: active.maxListenSec,
        listenPct: d.listenPct ?? 0,
        wrongPct: d.wrongPct ?? 0,
        listenAmount: d.listenAmount ?? 0,
        wrongAmount: d.wrongAmount ?? 0,
        capped: d.capped ?? false,
        pointsAdded,
      };

      set({
        phase: 'revealed',
        teams: s.teams.map((t) =>
          t.id === team.id ? { ...t, totalViewsScore: t.totalViewsScore + pointsAdded } : t,
        ),
        lastResult: entry,
        history: [entry, ...s.history],
        scoreFlash: { teamId: team.id, amount: pointsAdded, nonce: entry.id },
      });
    };

    return {
      ...initialState(),

      setSongs: (songs) => set({ songs }),

      startGame: (config) => {
        const names = config.teamNames
          .slice(0, MAX_TEAMS)
          .map((name, i) => name.trim() || DEFAULT_TEAM_NAMES[i]);
        if (names.length < MIN_TEAMS) {
          throw new RangeError(`A game needs at least ${MIN_TEAMS} teams`);
        }
        const maxRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(config.maxRounds)));
        set({
          phase: 'pickLevel',
          setup: { teamNames: names, maxRounds },
          teams: names.map((name, i) => ({ id: i + 1, name, totalViewsScore: 0 })),
          currentTeamIndex: 0,
          round: 1,
          maxRounds,
          active: null,
          lastResult: null,
          history: [],
          scoreFlash: null,
          playedKeys: [],
        });
      },

      selectLevel: (level) => {
        const s = get();
        if (s.phase !== 'pickLevel') return false;
        const song = drawSong(s.songs, s.playedKeys, level, rng);
        if (!song) return false;
        set({
          phase: 'listening',
          active: { song, wrongGuesses: 0, maxListenSec: 0, startedAt: null },
          playedKeys: [...s.playedKeys, songKey(song.songName)],
        });
        return true;
      },

      playClip: (seconds) => {
        const s = get();
        if (s.phase !== 'listening' || !s.active || !isListenStep(seconds)) return;
        set({
          active: {
            ...s.active,
            maxListenSec: Math.max(s.active.maxListenSec, seconds),
            startedAt: s.active.startedAt ?? Date.now(),
          },
        });
      },

      handleGuess: (teamId, isCorrect, songExactViews) => {
        const s = get();
        const team = s.teams[s.currentTeamIndex];
        const active = s.active;
        if (s.phase !== 'listening' || !active || !team || team.id !== teamId) return 'ignored';
        // A guess can't be judged before the team has heard at least one clip.
        if (active.maxListenSec < 1) return 'ignored';
        if (songExactViews !== active.song.exactViews) {
          console.warn(
            `handleGuess: songExactViews (${songExactViews}) differs from the active song (${active.song.exactViews})`,
          );
        }

        if (isCorrect) {
          const b = getScoreBreakdown({
            exactViews: songExactViews,
            listenSeconds: active.maxListenSec,
            wrongGuessesBefore: active.wrongGuesses,
          });
          settle('solved', b.total, {
            guessesUsed: active.wrongGuesses + 1,
            exactViews: songExactViews,
            listenPct: b.listenPct,
            wrongPct: b.wrongPct,
            listenAmount: b.listenAmount,
            wrongAmount: b.wrongAmount,
            capped: b.capped,
          });
          return 'solved';
        }

        if (active.wrongGuesses + 1 >= MAX_GUESSES) {
          settle('failed', MISS_PENALTY, { guessesUsed: MAX_GUESSES });
          return 'failed';
        }
        set({ active: { ...active, wrongGuesses: active.wrongGuesses + 1 } });
        return 'wrong';
      },

      failActiveSong: () => {
        const s = get();
        if (s.phase !== 'listening' || !s.active) return;
        settle('timeout', MISS_PENALTY, { guessesUsed: s.active.wrongGuesses });
      },

      skipUnplayable: () => {
        const s = get();
        if (s.phase !== 'listening' || !s.active) return;
        const next = drawSong(s.songs, s.playedKeys, s.active.song.level, rng);
        if (!next) {
          set({ phase: 'pickLevel', active: null });
          return;
        }
        set({
          active: { song: next, wrongGuesses: 0, maxListenSec: 0, startedAt: null },
          playedKeys: [...s.playedKeys, songKey(next.songName)],
        });
      },

      nextTurn: () => {
        const s = get();
        if (s.phase !== 'revealed') return;
        const next = (s.currentTeamIndex + 1) % s.teams.length;
        const round = next === 0 ? s.round + 1 : s.round;
        if (round > s.maxRounds) {
          set({ phase: 'gameOver', active: null, scoreFlash: null });
          return;
        }
        set({ phase: 'pickLevel', currentTeamIndex: next, round, active: null, scoreFlash: null });
      },

      playAgain: () => get().startGame(get().setup),

      newSetup: () =>
        set({
          phase: 'setup',
          teams: [],
          currentTeamIndex: 0,
          round: 1,
          active: null,
          lastResult: null,
          history: [],
          scoreFlash: null,
          playedKeys: [],
        }),
    };
  });
}

/** The app's single store. Tests build isolated ones with createGameStore(). */
export const useGameStore = createGameStore();

export const selectCurrentTeam = (s: GameState): Team | undefined => s.teams[s.currentTeamIndex];

/** True when the turn being played (or just revealed) is the very last of the game. */
export const selectIsFinalTurn = (s: GameState): boolean =>
  s.teams.length > 0 && s.currentTeamIndex === s.teams.length - 1 && s.round === s.maxRounds;

export const selectRemainingAtLevel = (s: GameState, level: Level): number =>
  s.songs.filter((song) => song.level === level && !s.playedKeys.includes(songKey(song.songName))).length;
