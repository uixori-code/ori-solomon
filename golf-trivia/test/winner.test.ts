import { describe, expect, it } from 'vitest';
import type { Team } from '../src/types';
import { determineWinner } from '../src/winner';

const team = (id: number, name: string, totalViewsScore: number): Team => ({ id, name, totalViewsScore });

describe('determineWinner', () => {
  it('the LOWEST total wins', () => {
    const r = determineWinner([team(1, 'A', 2_613_028_128), team(2, 'B', 1_204_500_000), team(3, 'C', 10_000_000_000)]);
    expect(r.winners.map((t) => t.name)).toEqual(['B']);
    expect(r.isTie).toBe(false);
    expect(r.ranking.map((t) => [t.name, t.rank])).toEqual([['B', 1], ['A', 2], ['C', 3]]);
  });

  it('equal lowest totals are co-winners and share rank 1', () => {
    const r = determineWinner([team(1, 'A', 500), team(2, 'B', 500), team(3, 'C', 900)]);
    expect(r.winners.map((t) => t.name)).toEqual(['A', 'B']);
    expect(r.isTie).toBe(true);
    expect(r.ranking.map((t) => t.rank)).toEqual([1, 1, 3]);
  });

  it('does not mutate the input order', () => {
    const teams = [team(1, 'A', 9), team(2, 'B', 1)];
    determineWinner(teams);
    expect(teams.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('handles no teams', () => {
    expect(determineWinner([])).toEqual({ winners: [], isTie: false, ranking: [] });
  });
});
