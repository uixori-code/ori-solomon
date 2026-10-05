import { describe, expect, it } from 'vitest';
import {
  MISS_PENALTY,
  analyze,
  cellText,
  dedupeRows,
  extractRows,
  findHeader,
  parseViews,
  selectAndOrder,
} from '../scripts/lib/sheet.mjs';

describe('parseViews', () => {
  it('reads the sheet formats', () => {
    expect(parseViews('1.5B')).toBe(1_500_000_000);
    expect(parseViews('980M')).toBe(980_000_000);
    expect(parseViews('1B')).toBe(1_000_000_000);
    expect(parseViews('2.7B')).toBe(2_700_000_000);
    expect(parseViews('12.5M')).toBe(12_500_000);
    expect(parseViews('850K')).toBe(850_000);
    expect(parseViews('1,234,567')).toBe(1_234_567);
    expect(parseViews('2B+')).toBe(2_000_000_000);
    expect(parseViews(589450123)).toBe(589_450_123);
  });
  it('always returns a whole number', () => {
    for (const raw of ['1.1B', '2.1B', '3.3B', '0.7M', '6.1B']) {
      expect(Number.isInteger(parseViews(raw))).toBe(true);
    }
    expect(parseViews('1.1B')).toBe(1_100_000_000);
  });
  it('returns null for text it cannot read', () => {
    expect(parseViews('')).toBeNull();
    expect(parseViews('lots')).toBeNull();
    expect(parseViews(null)).toBeNull();
    expect(parseViews('-5M')).toBeNull();
  });
});

describe('cellText', () => {
  it('unwraps rich text, hyperlink and formula cells', () => {
    expect(cellText({ richText: [{ text: 'Ab' }, { text: 'c ' }] })).toBe('Abc');
    expect(cellText({ text: 'Queen - Bohemian Rhapsody', hyperlink: 'https://x' })).toBe('Queen - Bohemian Rhapsody');
    expect(cellText({ formula: 'A1', result: 7 })).toBe('7');
    expect(cellText(null)).toBe('');
    expect(cellText(3)).toBe('3');
  });
});

// The real tabs have two blank/note rows above the header and index notes in a far-right column.
const grid = (...dataRows) => [
  [],
  ['', '', '', '', '', '', '', '', '', '', 'index note'],
  ['Category', 'Region', 'Level', 'Artist_and_Song', 'Estimated_Views', 'YouTube_Link', '', '', '', '', '.'],
  ...dataRows,
];

describe('findHeader / extractRows', () => {
  it('finds the header below the note rows', () => {
    expect(findHeader(grid()).rowIndex).toBe(2);
  });

  it('reads valid rows and ignores note-only rows', () => {
    const { rows, problems } = extractRows(
      'Rock',
      grid(
        ['Rock_Metal', 'Foreign', 1, 'Queen - Bohemian Rhapsody', '1.7B', 'https://www.youtube.com/results?search_query=Queen', '', '', '', '', 'note text'],
        ['', '', '', '', '', '', '', '', '', '', 'only a side note'],
        ['Rock_Metal', 'Foreign', '2', 'REM - Losing My Religion', '980M', { text: 'link', hyperlink: 'https://y' }],
      ),
    );
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ category: 'Rock_Metal', region: 'Foreign', level: 1, exact_views: 1_700_000_000, estimated_views: '1.7B', row: 4 });
    expect(rows[1]).toMatchObject({ level: 2, exact_views: 980_000_000 });
  });

  it('reports unusable rows instead of fixing them', () => {
    const { rows, problems } = extractRows(
      'Pop',
      grid(
        ['Pop', 'Foreign', 1, 'Too Big - Song', '10B', ''],
        ['Pop', 'Foreign', 1, 'Equal - To Limit', '10000M', ''],
        ['Pop', 'Foreign', 7, 'Bad - Level', '1B', ''],
        ['Pop', 'Foreign', 1, 'Bad - Views', 'lots', ''],
        ['', 'Foreign', 1, 'No - Category', '1B', ''],
        ['Pop', 'Foreign', 1, 'Fine - Song', '3.4B', ''],
      ),
    );
    expect(rows.map((r) => r.artist_and_song)).toEqual(['Fine - Song']);
    expect(problems).toHaveLength(5);
    expect(problems.join('\n')).toMatch(/Too Big - Song.*not below/);
    expect(problems.join('\n')).toMatch(/Bad - Level.*Level must be 1-5/);
  });

  it('keeps a song just under the ceiling', () => {
    const { rows } = extractRows('Pop', grid(['Pop', 'Foreign', 1, 'Just - Under', '9.99B', '']));
    expect(rows).toHaveLength(1);
    expect(rows[0].exact_views).toBeLessThan(MISS_PENALTY);
  });

  it('says so when there is no header', () => {
    expect(extractRows('Empty', [[], ['a', 'b']]).problems[0]).toMatch(/no header row/);
  });
});

const row = (category, region, level, name, views) => ({
  category, region, level, artist_and_song: name, exact_views: views, estimated_views: String(views), youtube_link: null,
});

describe('dedupeRows / selectAndOrder', () => {
  it('drops repeats of the same category+region+song, ignoring case and spacing', () => {
    const { rows, duplicates } = dedupeRows([
      row('Pop', 'Foreign', 1, 'Shakira - Waka Waka', 3_800_000_000),
      row('Pop', 'Foreign', 1, ' shakira  - waka waka', 3_800_000_000),
      row('Latin_Mizrahi', 'Foreign', 1, 'Shakira - Waka Waka', 3_800_000_000), // other category: kept
    ]);
    expect(rows).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
  });

  it('puts Rock_Metal first, then Pop, then everything else, and can filter', () => {
    const all = [
      row('Hip_Hop_Rap', 'Foreign', 1, 'A', 1),
      row('Pop', 'Foreign', 1, 'B', 1),
      row('Rock_Metal', 'Foreign', 1, 'C', 1),
      row('Rock_Metal', 'Israeli', 1, 'D', 1),
    ];
    expect(selectAndOrder(all).map((r) => r.artist_and_song)).toEqual(['C', 'D', 'B', 'A']);
    expect(selectAndOrder(all, ['rock_metal', 'POP']).map((r) => r.artist_and_song)).toEqual(['C', 'D', 'B']);
  });
});

describe('analyze', () => {
  it('counts rows and finds the largest song', () => {
    const { counts, max } = analyze([
      row('Rock_Metal', 'Foreign', 1, 'Big', 2_100_000_000),
      row('Rock_Metal', 'Foreign', 2, 'Mid', 900_000_000),
      row('Rock_Metal', 'Israeli', 1, 'Local', 15_000_000),
    ]);
    expect(counts['Rock_Metal / Foreign']).toEqual({ total: 2, byLevel: { 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 } });
    expect(max.artist_and_song).toBe('Big');
  });

  it('warns when a lower level has fewer views than the next level', () => {
    const { overlaps } = analyze([
      row('Pop', 'Foreign', 1, 'Misc', 185_000_000), // level 1 but small
      row('Pop', 'Foreign', 2, 'Hit', 1_500_000_000), // level 2 but huge
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatch(/level 1 has "Misc".*level 2 has "Hit"/);
  });

  it('stays quiet when levels are in order', () => {
    expect(
      analyze([
        row('Pop', 'Foreign', 1, 'A', 3_000_000_000),
        row('Pop', 'Foreign', 2, 'B', 1_500_000_000),
        row('Pop', 'Foreign', 3, 'C', 700_000_000),
      ]).overlaps,
    ).toEqual([]);
  });
});
