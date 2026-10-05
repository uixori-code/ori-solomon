import { LEVELS, SAMPLE_VIDEO_ID } from '../config';
import type { Level, Song } from '../types';

// Phase 1 test data: made-up names and view counts, roughly inside each level's range
// (L1 = huge views ... L5 = small views). Every song plays the same sample video.
const EMBED_URL = `https://www.youtube.com/embed/${SAMPLE_VIDEO_ID}`;

const VIEWS: Record<Level, number[]> = {
  1: [2_847_331_902, 1_906_224_517, 1_512_038_790, 1_284_556_013, 1_101_947_268, 1_000_402_311],
  2: [589_450_123, 742_118_364, 913_570_229, 655_003_871, 801_266_945, 977_310_402],
  3: [312_774_056, 458_291_330, 227_605_918, 389_042_771, 274_918_603, 496_157_284],
  4: [143_820_677, 87_334_190, 191_502_846, 62_971_305, 118_446_052, 169_087_431],
  5: [31_205_874, 12_640_319, 48_772_160, 22_918_547, 39_551_026, 17_384_693],
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const DEMO_SONGS: Song[] = LEVELS.flatMap((level) =>
  VIEWS[level].map((exactViews, i) => ({
    id: `test-${level}${LETTERS[i].toLowerCase()}`,
    songName: `Test Song ${level}${LETTERS[i]}`,
    level,
    exactViews,
    embedUrl: EMBED_URL,
  })),
);
