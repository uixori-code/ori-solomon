import { describe, expect, it } from 'vitest';
import { MISS_PENALTY } from '../src/config';
import { calculateGuessScore, getScoreBreakdown, surchargePercents } from '../src/scoring';

const M100 = 100_000_000;

describe('calculateGuessScore: the three examples from the brief', () => {
  it('guess 1 @ 1 s = base views', () => {
    expect(calculateGuessScore({ exactViews: M100, listenSeconds: 1, wrongGuessesBefore: 0 })).toBe(100_000_000);
  });
  it('guess 1 @ 4 s = +4%', () => {
    expect(calculateGuessScore({ exactViews: M100, listenSeconds: 4, wrongGuessesBefore: 0 })).toBe(104_000_000);
  });
  it('guess 3 @ 1 s = +15% x 2', () => {
    expect(calculateGuessScore({ exactViews: M100, listenSeconds: 1, wrongGuessesBefore: 2 })).toBe(130_000_000);
  });
});

describe('calculateGuessScore: more cases', () => {
  it('adds listen % and wrong % together (guess 2 @ 8 s = +23%)', () => {
    expect(calculateGuessScore({ exactViews: M100, listenSeconds: 8, wrongGuessesBefore: 1 })).toBe(123_000_000);
  });

  it('uses the full ladder 1/2/4/8/16 s = 0/2/4/8/16 %', () => {
    const pcts = [1, 2, 4, 8, 16].map(
      (s) => calculateGuessScore({ exactViews: M100, listenSeconds: s, wrongGuessesBefore: 0 }) / M100 - 1,
    );
    expect(pcts.map((p) => Math.round(p * 100))).toEqual([0, 2, 4, 8, 16]);
  });

  it('rounds only the surcharge, never the base: 589,450,123 @ 4 s', () => {
    const b = getScoreBreakdown({ exactViews: 589_450_123, listenSeconds: 4, wrongGuessesBefore: 0 });
    expect(b.base).toBe(589_450_123);
    expect(b.listenAmount).toBe(23_578_005); // round(23,578,004.92)
    expect(b.total).toBe(613_028_128);
    expect(Number.isInteger(b.total)).toBe(true);
  });

  it('breakdown rows always add up to the total', () => {
    for (const views of [589_450_123, 1_284_556_013, 12_640_319, 7]) {
      for (const listenSeconds of [1, 2, 4, 8, 16]) {
        for (const wrongGuessesBefore of [0, 1, 2]) {
          const b = getScoreBreakdown({ exactViews: views, listenSeconds, wrongGuessesBefore });
          expect(b.base + b.listenAmount + b.wrongAmount).toBe(b.uncapped);
        }
      }
    }
  });

  it('caps a correct answer at the 10B fail penalty so a miss is never cheaper', () => {
    // 8.4B, guess 3, 16 s = +46% = 12.264B uncapped
    const b = getScoreBreakdown({ exactViews: 8_400_000_000, listenSeconds: 16, wrongGuessesBefore: 2 });
    expect(b.uncapped).toBe(12_264_000_000);
    expect(b.total).toBe(MISS_PENALTY);
    expect(b.capped).toBe(true);
  });

  it('does not cap when under the penalty', () => {
    const b = getScoreBreakdown({ exactViews: 8_400_000_000, listenSeconds: 1, wrongGuessesBefore: 0 });
    expect(b.total).toBe(8_400_000_000);
    expect(b.capped).toBe(false);
  });

  it('rejects invalid input instead of scoring it', () => {
    expect(() => calculateGuessScore({ exactViews: 1.5, listenSeconds: 1, wrongGuessesBefore: 0 })).toThrow(RangeError);
    expect(() => calculateGuessScore({ exactViews: M100, listenSeconds: 3, wrongGuessesBefore: 0 })).toThrow(RangeError);
    expect(() => calculateGuessScore({ exactViews: M100, listenSeconds: 0, wrongGuessesBefore: 0 })).toThrow(RangeError);
    expect(() => calculateGuessScore({ exactViews: M100, listenSeconds: 1, wrongGuessesBefore: 3 })).toThrow(RangeError);
  });
});

describe('surchargePercents', () => {
  it('reports only percentages', () => {
    expect(surchargePercents(4, 1)).toEqual({ listenPct: 4, wrongPct: 15, totalPct: 19 });
    expect(surchargePercents(0, 0)).toEqual({ listenPct: 0, wrongPct: 0, totalPct: 0 });
  });
});
