import { useMemo } from 'react';
import { cls } from '../cls';
import { formatViews, formatViewsCompact } from '../format';
import { useGameStore } from '../store';
import { teamStyle } from '../teamColors';
import { determineWinner } from '../winner';

export function WinnerScreen() {
  const teams = useGameStore((s) => s.teams);
  const playAgain = useGameStore((s) => s.playAgain);
  const newSetup = useGameStore((s) => s.newSetup);
  const { winners, isTie, ranking } = useMemo(() => determineWinner(teams), [teams]);

  if (winners.length === 0) return null;
  const title = isTie ? `It's a tie: ${winners.map((w) => w.name).join(' & ')}` : `${winners[0].name} wins!`;

  return (
    <div className="panel stage-panel winner">
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

      <div className="winner-actions">
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
