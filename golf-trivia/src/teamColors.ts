import type { CSSProperties } from 'react';

// Okabe-Ito colours: distinct on a dark background and safe for colour-blind viewers.
const TEAM_COLORS = ['#56B4E9', '#E69F00', '#CC79A7'];

export const teamColor = (teamId: number): string => TEAM_COLORS[(teamId - 1) % TEAM_COLORS.length];

/** Sets the --team CSS variable that the team dot, border and tag read. */
export const teamStyle = (teamId: number): CSSProperties => ({ '--team': teamColor(teamId) }) as CSSProperties;
