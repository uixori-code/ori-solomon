import { cls } from '../cls';
import { formatDelta } from '../format';
import { useGameStore } from '../store';
import { teamStyle } from '../teamColors';

const ICON = { solved: '✅', failed: '❌', timeout: '⏱' } as const;

/** Only revealed songs are listed, so this panel never gives a hint about the current song. */
export function History() {
  const history = useGameStore((s) => s.history);

  return (
    <aside className="panel history" aria-label="Revealed songs">
      <h2>Revealed songs</h2>
      {history.length === 0 ? (
        <p className="muted">Songs show up here after each reveal.</p>
      ) : (
        <ul>
          {history.map((entry) => (
            <li key={entry.id} style={teamStyle(entry.teamId)}>
              <span className="h-round">R{entry.round}</span>
              <span className="team-dot" aria-hidden="true" title={entry.teamName} />
              <span className="h-song" dir="auto">
                {entry.songName}
                <small>
                  {entry.teamName} · L{entry.level}
                </small>
              </span>
              <span className={cls('h-pts', entry.outcome !== 'solved' && 'is-bad')}>
                <span aria-hidden="true">{ICON[entry.outcome]}</span> {formatDelta(entry.pointsAdded)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
