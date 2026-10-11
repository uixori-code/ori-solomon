import { useMemo, useState } from 'react';
import { cls } from '../cls';
import { formatViews, formatViewsCompact } from '../format';
import { useGameStore } from '../store';
import { teamStyle } from '../teamColors';
import { renderResultsImage, summariseTeams } from '../shareImage';
import { determineWinner } from '../winner';
import { Confetti } from './Confetti';

export function WinnerScreen() {
  const teams = useGameStore((s) => s.teams);
  const playAgain = useGameStore((s) => s.playAgain);
  const newSetup = useGameStore((s) => s.newSetup);
  const history = useGameStore((s) => s.history);
  const [imgError, setImgError] = useState<string | null>(null);
  const { winners, isTie, ranking } = useMemo(() => determineWinner(teams), [teams]);

  if (winners.length === 0) return null;
  const title = isTie ? `It's a tie: ${winners.map((w) => w.name).join(' & ')}` : `${winners[0].name} wins!`;
  const summary = summariseTeams(ranking, history);

  const downloadImage = async () => {
    try {
      const blob = await renderResultsImage(title, summary);
      const file = new File([blob], 'golf-trivia-results.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Golf Trivia results' });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'golf-trivia-results.png';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // the share sheet was closed
      setImgError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="panel stage-panel winner pop">
      <Confetti pieces={90} />
      <p className="trophy" aria-hidden="true">
        🏆
      </p>
      <h2 className="winner-title" role="status">
        {title}
      </h2>
      <p className="muted">
        Lowest total: <b>{formatViews(winners[0].totalViewsScore)}</b> views
      </p>

      <ol className="final-ranking">
        {ranking.map((team) => (
          <li key={team.id} className={cls(team.rank === 1 && 'is-winner')} style={teamStyle(team.id)}>
            <span className="rank">{team.rank}</span>
            <span className="team-dot" aria-hidden="true" />
            <span className="team-name">{team.name}</span>
            <span className="final-compact">{formatViewsCompact(team.totalViewsScore)}</span>
            <span className="score">{formatViews(team.totalViewsScore)}</span>
          </li>
        ))}
      </ol>

      <div className="summary-grid">
        {summary.map(({ team, solved, best, worst }) => (
          <div key={team.id} className="summary-card" style={teamStyle(team.id)}>
            <p className="summary-name">
              <span className="team-dot" aria-hidden="true" /> {team.name}
            </p>
            <p className="muted">{solved} song{solved === 1 ? '' : 's'} solved</p>
            <p>
              ⭐ Best: <b dir="auto">{best ? best.songName : '-'}</b>
              {best && <small> {formatViewsCompact(best.pointsAdded)}</small>}
            </p>
            <p>
              💥 Worst: <b dir="auto">{worst ? worst.songName : '-'}</b>
              {worst && <small> {formatViewsCompact(worst.pointsAdded)}</small>}
            </p>
          </div>
        ))}
      </div>
      {imgError && (
        <p className="notice notice-error" role="alert">
          Couldn't make the image: {imgError}
        </p>
      )}

      <div className="winner-actions">
        <button type="button" className="btn" onClick={downloadImage}>
          📸 Save results image
        </button>
        <button type="button" className="btn btn-primary" onClick={playAgain}>
          Play again
        </button>
        <button type="button" className="btn" onClick={newSetup}>
          New setup
        </button>
      </div>
    </div>
  );
}
