import { IS_TEST_DATA } from '../data/songSource';
import { useGameStore } from '../store';
import { TestBadge } from './TestBadge';

export function Header() {
  const phase = useGameStore((s) => s.phase);
  const round = useGameStore((s) => s.round);
  const maxRounds = useGameStore((s) => s.maxRounds);
  const inGame = phase === 'pickLevel' || phase === 'listening' || phase === 'revealed';

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-flag" aria-hidden="true">
          ⛳
        </span>
        <h1>Golf Trivia</h1>
      </div>
      {inGame && (
        <div className="round-pill" aria-label={`Round ${round} of ${maxRounds}`}>
          Round <b>{round}</b> / {maxRounds}
        </div>
      )}
      {phase === 'gameOver' && <div className="round-pill">Final results</div>}
      <div className="header-right">
        {IS_TEST_DATA && <TestBadge />}
        <span className="rule-hint">Lowest views wins</span>
      </div>
    </header>
  );
}
