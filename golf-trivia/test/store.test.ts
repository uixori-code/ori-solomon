import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MISS_PENALTY, SAMPLE_VIDEO_ID } from '../src/config';
import { validateSongs } from '../src/data/validate';
import { createGameStore, selectIsFinalTurn } from '../src/store';
import type { Level, Song } from '../src/types';

const embedUrl = `https://www.youtube.com/embed/${SAMPLE_VIDEO_ID}`;
const song = (level: Level, exactViews: number, name = `Song ${level}-${exactViews}`): Song => ({
  id: name,
  songName: name,
  level,
  exactViews,
  embedUrl,
});

// One song per level keeps the random draw deterministic.
const POOL: Song[] = [
  song(1, 100_000_000, 'Hundred Mil'),
  song(2, 589_450_123, 'Five Eighty Nine'),
  song(3, 300_000_000, 'Three Hundred'),
  song(4, 100_000_000, 'Hundred Mil B'),
  song(5, 20_000_000, 'Twenty Mil'),
];

function newGame(rounds = 2, names = ['A', 'B']) {
  const store = createGameStore();
  store.getState().setSongs(POOL);
  store.getState().startGame({ teamNames: names, maxRounds: rounds });
  return store;
}

/** Pick a level, play a clip, return the active song. */
function startSong(store: ReturnType<typeof createGameStore>, level: Level, clip: number) {
  expect(store.getState().selectLevel(level)).toBe(true);
  store.getState().playClip(clip);
  return store.getState().active!.song;
}

const score = (store: ReturnType<typeof createGameStore>, teamId: number) =>
  store.getState().teams.find((t) => t.id === teamId)!.totalViewsScore;

describe('handleGuess scoring', () => {
  it('correct on guess 1 @ 1 s adds the exact views', () => {
    const store = newGame();
    const s = startSong(store, 1, 1);
    expect(store.getState().handleGuess(1, true, s.exactViews)).toBe('solved');
    expect(score(store, 1)).toBe(100_000_000);
    expect(store.getState().phase).toBe('revealed');
  });

  it('correct on guess 1 @ 4 s adds +4%', () => {
    const store = newGame();
    const s = startSong(store, 1, 4);
    store.getState().handleGuess(1, true, s.exactViews);
    expect(score(store, 1)).toBe(104_000_000);
  });

  it('correct on guess 3 @ 1 s adds +30% (two wrong guesses before)', () => {
    const store = newGame();
    const s = startSong(store, 1, 1);
    expect(store.getState().handleGuess(1, false, s.exactViews)).toBe('wrong');
    expect(store.getState().handleGuess(1, false, s.exactViews)).toBe('wrong');
    expect(score(store, 1)).toBe(0); // nothing is added until the song settles
    expect(store.getState().handleGuess(1, true, s.exactViews)).toBe('solved');
    expect(score(store, 1)).toBe(130_000_000);
    expect(store.getState().lastResult?.guessesUsed).toBe(3);
  });

  it('keeps integer views exact: 589,450,123 @ 4 s', () => {
    const store = newGame();
    const s = startSong(store, 2, 4);
    store.getState().handleGuess(1, true, s.exactViews);
    expect(score(store, 1)).toBe(613_028_128);
  });

  it('the surcharge uses the longest clip played, even if a shorter one is played later', () => {
    const store = newGame();
    const s = startSong(store, 1, 16);
    store.getState().playClip(1);
    expect(store.getState().active?.maxListenSec).toBe(16);
    store.getState().handleGuess(1, true, s.exactViews);
    expect(score(store, 1)).toBe(116_000_000);
  });

  it('three wrong guesses fail the song for exactly 10B', () => {
    const store = newGame();
    const s = startSong(store, 1, 1);
    store.getState().handleGuess(1, false, s.exactViews);
    store.getState().handleGuess(1, false, s.exactViews);
    expect(store.getState().handleGuess(1, false, s.exactViews)).toBe('failed');
    expect(score(store, 1)).toBe(MISS_PENALTY);
    expect(store.getState().lastResult?.outcome).toBe('failed');
  });

  it('time running out fails the song for 10B', () => {
    const store = newGame();
    startSong(store, 1, 1);
    store.getState().failActiveSong();
    expect(score(store, 1)).toBe(MISS_PENALTY);
    expect(store.getState().lastResult?.outcome).toBe('timeout');
  });

  it('a correct answer never costs more than failing', () => {
    const store = createGameStore();
    store.getState().setSongs([song(1, 8_400_000_000, 'Despacito-like')]);
    store.getState().startGame({ teamNames: ['A', 'B'], maxRounds: 1 });
    const s = startSong(store, 1, 16);
    store.getState().handleGuess(1, false, s.exactViews);
    store.getState().handleGuess(1, false, s.exactViews);
    store.getState().handleGuess(1, true, s.exactViews);
    expect(score(store, 1)).toBe(MISS_PENALTY);
    expect(store.getState().lastResult?.capped).toBe(true);
  });
});

describe('handleGuess is defensive', () => {
  it('ignores a guess for the wrong team', () => {
    const store = newGame();
    const s = startSong(store, 1, 1);
    expect(store.getState().handleGuess(2, true, s.exactViews)).toBe('ignored');
    expect(score(store, 1)).toBe(0);
    expect(score(store, 2)).toBe(0);
    expect(store.getState().phase).toBe('listening');
  });

  it('ignores a guess in the wrong phase', () => {
    const store = newGame();
    expect(store.getState().handleGuess(1, true, 100)).toBe('ignored'); // still on pickLevel
    const s = startSong(store, 1, 1);
    store.getState().handleGuess(1, true, s.exactViews);
    expect(store.getState().handleGuess(1, true, s.exactViews)).toBe('ignored'); // already revealed
    expect(score(store, 1)).toBe(100_000_000);
  });

  it('ignores a guess before any clip was played', () => {
    const store = newGame();
    expect(store.getState().selectLevel(1)).toBe(true);
    expect(store.getState().handleGuess(1, true, 100_000_000)).toBe('ignored');
    expect(store.getState().phase).toBe('listening');
  });

  it('warns when songExactViews does not match the active song', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = newGame();
    startSong(store, 1, 1);
    store.getState().handleGuess(1, true, 123);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// Two songs per level, so a 3-team, 2-round game (6 turns) can't run dry.
const BIG_POOL: Song[] = ([1, 2, 3, 4, 5] as Level[]).flatMap((level) => [
  song(level, 100_000_000 * level, `Big ${level}a`),
  song(level, 100_000_000 * level + 1, `Big ${level}b`),
]);

describe('turns, rounds and game end', () => {
  let store: ReturnType<typeof createGameStore>;
  beforeEach(() => {
    store = createGameStore();
    store.getState().setSongs(BIG_POOL);
    store.getState().startGame({ teamNames: ['A', 'B', 'C'], maxRounds: 2 });
  });

  const playTurn = (level: Level) => {
    const s = startSong(store, level, 1);
    const teamId = store.getState().teams[store.getState().currentTeamIndex].id;
    store.getState().handleGuess(teamId, true, s.exactViews);
    store.getState().nextTurn();
  };

  it('rotates A -> B -> C and bumps the round after the last team', () => {
    expect(store.getState().currentTeamIndex).toBe(0);
    expect(store.getState().round).toBe(1);
    playTurn(1);
    expect(store.getState().currentTeamIndex).toBe(1);
    playTurn(2);
    expect(store.getState().currentTeamIndex).toBe(2);
    expect(store.getState().round).toBe(1);
    playTurn(3);
    expect(store.getState().currentTeamIndex).toBe(0);
    expect(store.getState().round).toBe(2);
    expect(store.getState().phase).toBe('pickLevel');
  });

  it('ends after maxRounds and flags the final turn', () => {
    for (let i = 0; i < 5; i++) playTurn(((i % 5) + 1) as Level);
    // 5 of 6 turns done, the 6th is the final one
    expect(selectIsFinalTurn(store.getState())).toBe(true);
    const s = startSong(store, 5, 1);
    store.getState().handleGuess(3, true, s.exactViews);
    expect(store.getState().phase).toBe('revealed');
    store.getState().nextTurn();
    expect(store.getState().phase).toBe('gameOver');
  });

  it('never plays the same song twice in a game', () => {
    const first = startSong(store, 1, 1);
    store.getState().handleGuess(1, true, first.exactViews);
    store.getState().nextTurn();
    const second = startSong(store, 1, 1);
    expect(second.songName).not.toBe(first.songName);
    store.getState().handleGuess(2, true, second.exactViews);
    store.getState().nextTurn();
    expect(store.getState().selectLevel(1)).toBe(false); // both level-1 songs are used up
    expect(store.getState().phase).toBe('pickLevel');
  });

  it('skipUnplayable swaps in another song at the same level, at no cost', () => {
    store.getState().selectLevel(1);
    const first = store.getState().active!.song;
    store.getState().playClip(4);
    store.getState().skipUnplayable();
    const now = store.getState().active!;
    expect(now.song.level).toBe(1);
    expect(now.song.songName).not.toBe(first.songName);
    expect(now.maxListenSec).toBe(0);
    expect(now.wrongGuesses).toBe(0);
    expect(store.getState().teams.every((t) => t.totalViewsScore === 0)).toBe(true);
  });

  it('skipUnplayable returns to the picker when no other song is left at that level', () => {
    const small = newGame(); // one song per level
    small.getState().selectLevel(1);
    small.getState().skipUnplayable();
    expect(small.getState().phase).toBe('pickLevel');
    expect(small.getState().active).toBeNull();
  });

  it('playAgain restarts with the same teams and zero scores; newSetup returns to setup', () => {
    playTurn(1);
    store.getState().playAgain();
    expect(store.getState().phase).toBe('pickLevel');
    expect(store.getState().teams.map((t) => [t.name, t.totalViewsScore])).toEqual([['A', 0], ['B', 0], ['C', 0]]);
    expect(store.getState().history).toEqual([]);
    store.getState().newSetup();
    expect(store.getState().phase).toBe('setup');
  });
});

describe('startGame input handling', () => {
  it('trims names, fills blanks, clamps rounds and caps at 3 teams', () => {
    const store = createGameStore();
    store.getState().startGame({ teamNames: [' Reds ', '', 'Blues', 'Extra'], maxRounds: 99 });
    expect(store.getState().teams.map((t) => t.name)).toEqual(['Reds', 'Team B', 'Blues']);
    expect(store.getState().maxRounds).toBe(15);
  });
  it('needs at least two teams', () => {
    expect(() => createGameStore().getState().startGame({ teamNames: ['Solo'], maxRounds: 3 })).toThrow(RangeError);
  });
});

describe('validateSongs', () => {
  it('passes clean data', () => {
    expect(validateSongs(POOL)).toEqual([]);
  });
  it('flags a song at or above the 10B penalty, fractional views, bad embed and duplicates', () => {
    const issues = validateSongs([
      song(1, 10_500_000_000, 'Too Big'),
      song(1, 1.5, 'Fractional'),
      { ...song(2, 5, 'No Embed'), embedUrl: 'https://www.youtube.com/results?search_query=x' },
      song(3, 5, 'Dupe'),
      song(3, 6, ' dupe '),
    ]);
    expect(issues).toHaveLength(4);
    expect(issues.join('\n')).toMatch(/Too Big.*not below/);
  });
});
