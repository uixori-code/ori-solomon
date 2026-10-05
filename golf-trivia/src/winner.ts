import type { Team } from './types';

export interface RankedTeam extends Team {
  /** Competition ranking: equal totals share a rank (1, 1, 3). */
  rank: number;
}

export interface WinnerResult {
  winners: RankedTeam[];
  isTie: boolean;
  /** Lowest total first. Equal totals keep their seating order. */
  ranking: RankedTeam[];
}

export function rankTeams(teams: readonly Team[]): RankedTeam[] {
  const sorted = [...teams].sort((a, b) => a.totalViewsScore - b.totalViewsScore);
  return sorted.map((team) => {
    const firstWithSameScore = sorted.findIndex((t) => t.totalViewsScore === team.totalViewsScore);
    return { ...team, rank: firstWithSameScore + 1 };
  });
}

/** The team with the LOWEST total wins. Equal lowest totals are co-winners. */
export function determineWinner(teams: readonly Team[]): WinnerResult {
  const ranking = rankTeams(teams);
  const winners = ranking.filter((t) => t.rank === 1);
  return { winners, isTie: winners.length > 1, ranking };
}
