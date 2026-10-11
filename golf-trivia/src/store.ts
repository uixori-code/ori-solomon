import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_ROUNDS,
  DEFAULT_TEAM_NAMES,
  MAX_GUESSES,
  MAX_ROUNDS,
  MAX_TEAMS,
  MIN_ROUNDS,
  MIN_TEAMS,
  MISS_PENALTY,
  PASS_PENALTY,
  STREAK_BONUS_PCT,
  STREAK_NEEDED,
  isListenStep,
} from './config';
import { songKey } from './data/songKey';
import { getScoreBreakdown } from './scoring';
import type { ActiveSong, HistoryEntry, Level, Outcome, Song, Team } from './types';

export type Phase = 'setup' | 'pickLevel' | 'listening' | 'revealed' | 'gameOver';

export interface SetupConfig {
  teamNames: string[];
  maxRounds: number;
  /** Only play these categories (e.g. "Rock_Metal"). Empty or missing = all. */
  categories?: string[];
  /** "Foreign", "Israeli", or "all" / missing for both. */
  region?: string;
}

/** What handleGuess did: ignored (stray click), wrong (song continues), solved, or failed (3rd wrong). */
export type GuessResult = 'ignored' | 'wrong' | 'solved' | 'failed';

export interface GameState {
  phase: Phase;
  /** Every song that was loaded. */
  allSongs: Song[];
  /** True while the built-in test songs are in use. */
  isTestData: boolean;
  /** The songs this game draws from: allSongs narrowed by the setup's genre and region. */
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
  /** Epoch ms when the host paused the song, null when running. */
  pausedAt: number | null;
  lastResult: HistoryEntry | null;
  /** Revealed songs only, newest first. */
  history: HistoryEntry[];
  /** Drives the "+104,000,000" flash on the scoreboard. */
  scoreFlash: { teamId: number; amount: number; nonce: number } | null;
}

export interface GameActions {
  setSongs: (songs: Song[], isTest?: boolean) => void;
  startGame: (config: SetupConfig) => void;
  /** Ends the game early (used when no level has a song left). */
  endGame: () => void;
  /** Draws a random unplayed song at this level. Returns false if none is left. */
  selectLevel: (level: Level) => boolean;
  /** Records that a clip of this length was played (the longest one sets the surcharge). */
  playClip: (seconds: number) => void;
  /** Sets the second the music starts for the song being played (and every later draw of it). */
  setStartSec: (startSec: number) => void;
  /** Reveals the genre/region hint for this song (adds HINT_SURCHARGE_PCT to its cost). */
  showHint: () => void;
  /** Gives up on the song: it is revealed, the team is charged PASS_PENALTY and the turn ends. */
  passSong: () => void;
  /** Freezes the song timer (the UI also stops the audio). */
  pauseGame: () => void;
  resumeGame: () => void;
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

/** allSongs narrowed to the chosen categories and region. */
export function filterSongs(songs: readonly Song[], config: Pick<SetupConfig, 'categories' | 'region'>): Song[] {
  const categories = config.categories?.length ? config.categories : null;
  const region = config.region && config.region !== 'all' ? config.region : null;
  return songs.filter(
    (song) => (!categories || (song.category !== undefined && categories.includes(song.category))) && (!region || song.region === region),
  );
}

const initialState = (): GameState => ({
  phase: 'setup',
  allSongs: [],
  isTestData: false,
  songs: [],
  playedKeys: [],
  setup: { teamNames: DEFAULT_TEAM_NAMES.slice(0, MIN_TEAMS), maxRounds: DEFAULT_ROUNDS },
  teams: [],
  currentTeamIndex: 0,
  round: 1,
  maxRounds: DEFAULT_ROUNDS,
  active: null,
  pausedAt: null,
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
  hintPct?: number;
  hintAmount?: number;
  streakPct?: number;
  streakAmount?: number;
}

/** How many songs in a row this team has solved on the first guess (newest history first). */
export function firstGuessStreak(history: readonly HistoryEntry[], teamId: number): number {
  let n = 0;
  for (const e of history) {
    if (e.teamId !== teamId) continue;
    if (e.outcome === 'solved' && e.guessesUsed === 1) n++;
    else break;
  }
  return n;
}

/** Only the live game is saved (not the song list, which is reloaded). A game that was mid-song reopens paused. */
const SAVE_KEY = 'golf-trivia-save-v1';
const savedKeys = ['phase', 'setup', 'teams', 'currentTeamIndex', 'round', 'maxRounds', 'active', 'pausedAt', 'lastResult', 'history', 'playedKeys', 'scoreFlash'] as const;

const safeStorage = {
  getItem: (name: string) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage blocked or full: the game still works, it just can't be resumed */
    }
  },
  removeItem: (name: string) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export function createGameStore(rng: () => number = Math.random, saveProgress = false) {
  const creator: StateCreator<GameStore> = (set, get) => {
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
        songNumber: active.song.number,
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
        hintPct: d.hintPct ?? 0,
        hintAmount: d.hintAmount ?? 0,
        streakPct: d.streakPct ?? 0,
        streakAmount: d.streakAmount ?? 0,
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

      setSongs: (songs, isTest = false) => {
        // A saved game that is already under way keeps its genre/region filter.
        const s = get();
        const narrowed = s.phase === 'setup' ? songs : filterSongs(songs, s.setup);
        set({ allSongs: songs, songs: narrowed, isTestData: isTest });
      },

      endGame: () => {
        if (get().phase !== 'pickLevel') return;
        set({ phase: 'gameOver', active: null, scoreFlash: null });
      },

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
          songs: filterSongs(get().allSongs, config),
          setup: { teamNames: names, maxRounds, categories: config.categories, region: config.region },
          teams: names.map((name, i) => ({ id: i + 1, name, totalViewsScore: 0 })),
          currentTeamIndex: 0,
          round: 1,
          maxRounds,
          active: null,
          pausedAt: null,
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
          active: { song, wrongGuesses: 0, maxListenSec: 0, startedAt: null, hintUsed: false },
          playedKeys: [...s.playedKeys, songKey(song.songName)],
        });
        return true;
      },

      playClip: (seconds) => {
        const s = get();
        if (s.phase !== 'listening' || s.pausedAt !== null || !s.active || !isListenStep(seconds)) return;
        set({
          active: {
            ...s.active,
            maxListenSec: Math.max(s.active.maxListenSec, seconds),
            startedAt: s.active.startedAt ?? Date.now(),
          },
        });
      },

      setStartSec: (startSec) => {
        const s = get();
        if (!s.active || !Number.isFinite(startSec)) return;
        const sec = Math.max(0, Math.min(3600, startSec));
        const apply = (song: Song) => (song.id === s.active!.song.id ? { ...song, startSec: sec } : song);
        set({
          // A new start makes earlier listening meaningless: clear it so the clip lengths and cost start fresh.
          active: {
            ...s.active,
            song: apply(s.active.song),
            ...((s.active.song.startSec ?? 0) !== sec && { maxListenSec: 0, startedAt: null }),
          },
          allSongs: s.allSongs.map(apply),
          songs: s.songs.map(apply),
        });
      },

      showHint: () => {
        const s = get();
        if (s.phase !== 'listening' || s.pausedAt !== null || !s.active || s.active.hintUsed) return;
        set({ active: { ...s.active, hintUsed: true } });
      },

      passSong: () => {
        const s = get();
        if (s.phase !== 'listening' || s.pausedAt !== null || !s.active) return;
        settle('passed', PASS_PENALTY, { guessesUsed: s.active.wrongGuesses });
      },

      pauseGame: () => {
        const s = get();
        if (s.phase !== 'listening' || s.pausedAt !== null) return;
        set({ pausedAt: Date.now() });
      },

      resumeGame: () => {
        const s = get();
        if (s.pausedAt === null) return;
        const frozenFor = Date.now() - s.pausedAt;
        set({
          pausedAt: null,
          // Slide the start forward so the time spent paused doesn't count against the song.
          active: s.active && s.active.startedAt !== null ? { ...s.active, startedAt: s.active.startedAt + frozenFor } : s.active,
        });
      },

      handleGuess: (teamId, isCorrect, songExactViews) => {
        const s = get();
        const team = s.teams[s.currentTeamIndex];
        const active = s.active;
        if (s.phase !== 'listening' || s.pausedAt !== null || !active || !team || team.id !== teamId) return 'ignored';
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
            hintUsed: active.hintUsed,
            streakPct:
              active.wrongGuesses === 0 && firstGuessStreak(s.history, team.id) + 1 >= STREAK_NEEDED ? STREAK_BONUS_PCT : 0,
          });
          settle('solved', b.total, {
            guessesUsed: active.wrongGuesses + 1,
            exactViews: songExactViews,
            listenPct: b.listenPct,
            wrongPct: b.wrongPct,
            listenAmount: b.listenAmount,
            wrongAmount: b.wrongAmount,
            capped: b.capped,
            hintPct: b.hintPct,
            hintAmount: b.hintAmount,
            streakPct: b.streakPct,
            streakAmount: b.streakAmount,
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
        if (s.phase !== 'listening' || s.pausedAt !== null || !s.active) return;
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
          active: { song: next, wrongGuesses: 0, maxListenSec: 0, startedAt: null, hintUsed: false },
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
        set({ phase: 'pickLevel', currentTeamIndex: next, round, active: null, pausedAt: null, scoreFlash: null });
      },

      playAgain: () => get().startGame(get().setup),

      newSetup: () =>
        set({
          phase: 'setup',
          teams: [],
          currentTeamIndex: 0,
          round: 1,
          active: null,
          pausedAt: null,
          lastResult: null,
          history: [],
          scoreFlash: null,
          playedKeys: [],
        }),
    };
  };

  if (!saveProgress) return create<GameStore>()(creator);
  return create<GameStore>()(
    persist(creator, {
      name: SAVE_KEY,
      storage: {
        getItem: (name) => {
          const raw = safeStorage.getItem(name);
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => safeStorage.setItem(name, JSON.stringify(value)),
        removeItem: safeStorage.removeItem,
      },
      partialize: (s) => Object.fromEntries(savedKeys.map((k) => [k, s[k]])) as unknown as GameStore,
      merge: (saved, current) => {
        const next = { ...current, ...(saved as Partial<GameStore>) };
        // Reopening mid-song must not eat the clock: come back paused.
        if (next.phase === 'listening' && next.pausedAt === null) next.pausedAt = Date.now();
        return next;
      },
    }),
  );
}

/** The app's single store. Tests build isolated ones with createGameStore(). */
export const useGameStore = createGameStore(Math.random, true);

export const selectCurrentTeam = (s: GameState): Team | undefined => s.teams[s.currentTeamIndex];

/** True when the turn being played (or just revealed) is the very last of the game. */
export const selectIsFinalTurn = (s: GameState): boolean =>
  s.teams.length > 0 && s.currentTeamIndex === s.teams.length - 1 && s.round === s.maxRounds;

export const selectRemainingAtLevel = (s: GameState, level: Level): number =>
  s.songs.filter((song) => song.level === level && !s.playedKeys.includes(songKey(song.songName))).length;
