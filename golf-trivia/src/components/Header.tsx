import { setSoundOn, useSoundOn } from '../sound';
import { useGameStore } from '../store';
import { setTvMode, useTvMode } from '../tvMode';
import { TestBadge } from './TestBadge';

export function Header() {
  const phase = useGameStore((s) => s.phase);
  const round = useGameStore((s) => s.round);
  const maxRounds = useGameStore((s) => s.maxRounds);
  const isTestData = useGameStore((s) => s.isTestData);
  const soundOn = useSoundOn();
  const tv = useTvMode();
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
        {isTestData && <TestBadge />}
        <span className="rule-hint">Lowest views wins</span>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Sound on, click to mute' : 'Sound off, click to turn on'}
          title={soundOn ? 'Mute sound effects' : 'Turn on sound effects'}
          onClick={() => setSoundOn(!soundOn)}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={tv}
          aria-label="TV mode: bigger text and full screen"
          title="TV mode (big text, full screen)"
          onClick={() => setTvMode(!tv)}
        >
          📺
        </button>
      </div>
    </header>
  );
}
