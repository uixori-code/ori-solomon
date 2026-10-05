import { describe, expect, it } from 'vitest';
import { categoryLabel, sortCategories } from '../src/categoryLabel';
import { SAMPLE_VIDEO_ID } from '../src/config';
import { rowsToSongs, type SongRow } from '../src/data/supabaseSongs';
import { createGameStore, filterSongs } from '../src/store';
import type { Level, Song } from '../src/types';

const row = (over: Partial<SongRow> = {}): SongRow => ({
  id: 1,
  category: 'Rock_Metal',
  region: 'Foreign',
  level: 1,
  artist_and_song: 'Queen - Bohemian Rhapsody',
  exact_views: 1_700_000_000,
  embed_url: `https://www.youtube.com/embed/${SAMPLE_VIDEO_ID}`,
  ...over,
});

describe('rowsToSongs (Supabase rows -> playable songs)', () => {
  it('maps a row to the Song shape the game uses', () => {
    const { songs, problems } = rowsToSongs([row()]);
    expect(problems).toEqual([]);
    expect(songs[0]).toEqual({
      id: '1',
      songName: 'Queen - Bohemian Rhapsody',
      level: 1,
      exactViews: 1_700_000_000,
      embedUrl: `https://www.youtube.com/embed/${SAMPLE_VIDEO_ID}`,
      category: 'Rock_Metal',
      region: 'Foreign',
    });
  });

  it('reads bigint views that arrive as strings', () => {
    expect(rowsToSongs([row({ exact_views: '589450123' })]).songs[0].exactViews).toBe(589_450_123);
  });

  it('drops and reports rows that cannot be played safely', () => {
    const { songs, problems } = rowsToSongs([
      row({ id: 1 }),
      row({ id: 2, artist_and_song: 'Too Big', exact_views: 12_000_000_000 }),
      row({ id: 3, artist_and_song: 'No Video', embed_url: null }),
      row({ id: 4, artist_and_song: 'Bad Level', level: 9 }),
      row({ id: 5, artist_and_song: 'No Views', exact_views: null }),
    ]);
    expect(songs.map((s) => s.id)).toEqual(['1']);
    expect(problems).toHaveLength(4);
  });
});

const mk = (id: string, level: Level, category?: string, region?: string): Song => ({
  id,
  songName: id,
  level,
  exactViews: 1,
  embedUrl: `https://www.youtube.com/embed/${SAMPLE_VIDEO_ID}`,
  category,
  region,
});
const SONGS = [
  mk('r1', 1, 'Rock_Metal', 'Foreign'),
  mk('r2', 2, 'Rock_Metal', 'Israeli'),
  mk('p1', 1, 'Pop', 'Foreign'),
  mk('h1', 1, 'Hip_Hop_Rap', 'Foreign'),
  mk('demo', 3),
];

describe('filterSongs', () => {
  const ids = (songs: Song[]) => songs.map((s) => s.id);
  it('no filter keeps everything', () => {
    expect(ids(filterSongs(SONGS, {}))).toEqual(['r1', 'r2', 'p1', 'h1', 'demo']);
    expect(ids(filterSongs(SONGS, { categories: [], region: 'all' }))).toHaveLength(5);
  });
  it('filters by category and by region', () => {
    expect(ids(filterSongs(SONGS, { categories: ['Rock_Metal'] }))).toEqual(['r1', 'r2']);
    expect(ids(filterSongs(SONGS, { categories: ['Rock_Metal', 'Pop'] }))).toEqual(['r1', 'r2', 'p1']);
    expect(ids(filterSongs(SONGS, { region: 'Israeli' }))).toEqual(['r2']);
    expect(ids(filterSongs(SONGS, { categories: ['Pop'], region: 'Israeli' }))).toEqual([]);
  });
});

describe('store: song pool and ending early', () => {
  it('startGame draws only from the chosen genres and region', () => {
    const store = createGameStore();
    store.getState().setSongs(SONGS);
    store.getState().startGame({ teamNames: ['A', 'B'], maxRounds: 1, categories: ['Rock_Metal'], region: 'Foreign' });
    expect(store.getState().songs.map((s) => s.id)).toEqual(['r1']);
    expect(store.getState().selectLevel(2)).toBe(false); // r2 is Israeli, filtered out
    expect(store.getState().selectLevel(1)).toBe(true);
    expect(store.getState().active?.song.id).toBe('r1');
  });

  it('playAgain keeps the same genre and region', () => {
    const store = createGameStore();
    store.getState().setSongs(SONGS);
    store.getState().startGame({ teamNames: ['A', 'B'], maxRounds: 1, categories: ['Pop'] });
    store.getState().playAgain();
    expect(store.getState().songs.map((s) => s.id)).toEqual(['p1']);
  });

  it('setSongs records whether the songs are test songs', () => {
    const store = createGameStore();
    store.getState().setSongs(SONGS, true);
    expect(store.getState().isTestData).toBe(true);
    store.getState().setSongs(SONGS);
    expect(store.getState().isTestData).toBe(false);
  });

  it('endGame goes to the results from the level picker only', () => {
    const store = createGameStore();
    store.getState().setSongs(SONGS);
    store.getState().endGame();
    expect(store.getState().phase).toBe('setup'); // ignored outside a game
    store.getState().startGame({ teamNames: ['A', 'B'], maxRounds: 2 });
    store.getState().endGame();
    expect(store.getState().phase).toBe('gameOver');
  });
});

describe('category labels', () => {
  it('prettifies names and puts Rock & Metal, then Pop, first', () => {
    expect(categoryLabel('Rock_Metal')).toBe('Rock & Metal');
    expect(categoryLabel('Some_New_Genre')).toBe('Some New Genre');
    expect(sortCategories(['Latin_Mizrahi', 'Pop', 'Hip_Hop_Rap', 'Rock_Metal'])).toEqual([
      'Rock_Metal',
      'Pop',
      'Hip_Hop_Rap',
      'Latin_Mizrahi',
    ]);
  });
});
