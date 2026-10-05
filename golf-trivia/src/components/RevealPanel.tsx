import { cls } from '../cls';
import { MAX_GUESSES, MISS_PENALTY } from '../config';
import { formatViews } from '../format';
import { selectIsFinalTurn, useGameStore } from '../store';
import { TeamTag } from './TeamTag';

export function RevealPanel() {
  const result = useGameStore((s) => s.lastResult);
  const isFinal = useGameStore(selectIsFinalTurn);
  const nextTeamName = useGameStore((s) => s.teams[(s.currentTeamIndex + 1) % s.teams.length]?.name);
  const nextTurn = useGameStore((s) => s.nextTurn);

  if (!result) return null;
  const solved = result.outcome === 'solved';
  const cutByCap = result.capped ? result.exactViews + result.listenAmount + result.wrongAmount - result.pointsAdded : 0;

  const banner = solved
    ? `Solved on guess ${result.guessesUsed}`
    : result.outcome === 'timeout'
      ? "Time's up"
      : `Failed: ${MAX_GUESSES} wrong guesses`;

  return (
    <div className={cls('panel stage-panel reveal', solved ? 'is-solved' : 'is-failed')}>
      <p className="reveal-banner" role="status">
        <span aria-hidden="true">{solved ? '✅' : result.outcome === 'timeout' ? '⏱' : '❌'}</span> {banner}
      </p>

      <h2 className="reveal-song" dir="auto">
        {result.songName}
      </h2>
      <p className="muted reveal-sub">
        Level {result.level} · <TeamTag id={result.teamId} name={result.teamName} />
      </p>

      <dl className="breakdown">
        {solved ? (
          <>
            <div>
              <dt>Song's views</dt>
              <dd>{formatViews(result.exactViews)}</dd>
            </div>
            <div>
              <dt>
                + listen ({result.listenSeconds}s) <em>+{result.listenPct}%</em>
              </dt>
              <dd>{formatViews(result.listenAmount)}</dd>
            </div>
            {result.wrongPct > 0 && (
              <div>
                <dt>
                  + {result.guessesUsed - 1} wrong guess{result.guessesUsed - 1 > 1 ? 'es' : ''} <em>+{result.wrongPct}%</em>
                </dt>
                <dd>{formatViews(result.wrongAmount)}</dd>
              </div>
            )}
            {result.capped && (
              <div>
                <dt>Capped at the {formatViews(MISS_PENALTY)} fail penalty</dt>
                <dd>−{formatViews(cutByCap)}</dd>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <dt>Song's views (the answer)</dt>
              <dd>{formatViews(result.exactViews)}</dd>
            </div>
            <div>
              <dt>Fixed penalty instead</dt>
              <dd>{formatViews(MISS_PENALTY)}</dd>
            </div>
          </>
        )}
        <div className="breakdown-total">
          <dt>= added to {result.teamName}</dt>
          <dd>{formatViews(result.pointsAdded)}</dd>
        </div>
      </dl>

      <button type="button" className="btn btn-primary" onClick={nextTurn} autoFocus>
        {isFinal ? 'Final results →' : `Next: ${nextTeamName} →`}
      </button>
    </div>
  );
}
