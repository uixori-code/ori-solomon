import { useMemo } from 'react';
import { cls } from '../cls';
import { formatDelta, formatViews } from '../format';
import { useGameStore } from '../store';
import { teamStyle } from '../teamColors';
import { rankTeams } from '../winner';

export function Scoreboard() {
  const teams = useGameStore((s) => s.teams);
  const currentId = useGameStore((s) => s.teams[s.currentTeamIndex]?.id);
  const flash = useGameStore((s) => s.scoreFlash);

  const ranking = useMemo(() => rankTeams(teams), [teams]);
  const allTied = ranking.every((t) => t.rank === 1);

  return (
    <section className="scoreboard" aria-label="Scoreboard, lowest views first">
      <ol>
        {ranking.map((team) => (
          <li
            key={team.id}
            className={cls('score-row', team.id === currentId && 'is-current')}
            style={teamStyle(team.id)}
          >
            <div className="score-top">
              <span className="rank">{team.rank}</span>
              <span className="team-dot" aria-hidden="true" />
              <span className="team-name">{team.name}</span>
              {team.id === currentId && <span className="chip chip-turn">▶ up now</span>}
              {!allTied && team.rank === 1 && <span className="chip chip-lead">leading</span>}
            </div>
            <div className="score-bottom">
              <span className="score-flash-slot" aria-live="polite">
                {flash?.teamId === team.id && (
                  <span key={flash.nonce} className="score-flash">
                    {formatDelta(flash.amount)}
                  </span>
                )}
              </span>
              <span className="score">{formatViews(team.totalViewsScore)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
