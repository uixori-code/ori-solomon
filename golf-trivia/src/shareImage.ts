import { formatViews } from './format';
import { teamAvatar, teamColor } from './teamColors';
import type { HistoryEntry } from './types';
import type { RankedTeam } from './winner';

export interface TeamSummary {
  team: RankedTeam;
  solved: number;
  best: HistoryEntry | null;
  worst: HistoryEntry | null;
}

/** Per team: how many songs solved, the cheapest solve (best) and the most expensive song (worst). */
export function summariseTeams(ranking: readonly RankedTeam[], history: readonly HistoryEntry[]): TeamSummary[] {
  return ranking.map((team) => {
    const mine = history.filter((h) => h.teamId === team.id);
    const solved = mine.filter((h) => h.outcome === 'solved');
    const best = solved.length ? solved.reduce((a, b) => (b.pointsAdded < a.pointsAdded ? b : a)) : null;
    const worst = mine.length ? mine.reduce((a, b) => (b.pointsAdded > a.pointsAdded ? b : a)) : null;
    return { team, solved: solved.length, best, worst };
  });
}

/** Draws the results card and returns it as a PNG, ready to download or share. */
export function renderResultsImage(title: string, summary: readonly TeamSummary[]): Promise<Blob> {
  const W = 1080;
  const rowH = 330;
  const H = 300 + summary.length * rowH + 90;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const font = (px: number, weight = 700) => `${weight} ${px}px Fredoka, system-ui, sans-serif`;

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2f86f0');
  bg.addColorStop(1, '#1243a8');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  g.fillStyle = '#ffc531';
  g.font = font(84);
  g.strokeStyle = '#12306f';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.strokeText('Golf Trivia', W / 2, 120);
  g.fillText('Golf Trivia', W / 2, 120);
  g.fillStyle = '#fff';
  g.font = font(56);
  g.fillText(`🏆 ${title}`, W / 2, 210);

  const line = (e: HistoryEntry | null, label: string) => (e ? `${label}: ${e.songName} (${formatViews(e.pointsAdded)})` : `${label}: -`);
  const fit = (text: string, max: number) => {
    let t = text;
    while (g.measureText(t).width > max && t.length > 8) t = `${t.slice(0, -2)}…`;
    return t;
  };

  summary.forEach(({ team, solved, best, worst }, i) => {
    const y = 260 + i * rowH;
    g.fillStyle = 'rgba(10,30,90,0.55)';
    g.beginPath();
    g.roundRect(50, y, W - 100, rowH - 30, 36);
    g.fill();
    g.fillStyle = teamColor(team.id);
    g.fillRect(50, y + 30, 14, rowH - 90);

    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.font = font(54);
    g.fillText(`${team.rank}. ${teamAvatar(team.id)} ${team.name}`, 100, y + 80);
    g.textAlign = 'right';
    g.fillStyle = '#ffc531';
    g.fillText(formatViews(team.totalViewsScore), W - 90, y + 80);
    g.textAlign = 'left';
    g.fillStyle = '#cfe3ff';
    g.font = font(36, 500);
    g.fillText(`${solved} song${solved === 1 ? '' : 's'} solved`, 100, y + 135);
    g.fillStyle = '#fff';
    g.fillText(fit(line(best, '⭐ Best'), W - 220), 100, y + 195);
    g.fillText(fit(line(worst, '💥 Worst'), W - 220), 100, y + 250);
  });

  g.textAlign = 'center';
  g.fillStyle = '#cfe3ff';
  g.font = font(32, 500);
  g.fillText('Lowest views wins', W / 2, H - 36);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the image'))), 'image/png'));
}
