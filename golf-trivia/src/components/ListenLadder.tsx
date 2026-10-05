import { cls } from '../cls';
import { LISTEN_STEPS, LISTEN_SURCHARGE_PCT, type ListenStep } from '../config';
import type { PlayerSnapshot } from '../player';

interface Props {
  /** Longest clip played on this song so far (0 = none). */
  maxListenSec: number;
  snapshot: PlayerSnapshot;
  disabled: boolean;
  onPlay: (seconds: ListenStep) => void;
}

export function ListenLadder({ maxListenSec, snapshot, disabled, onPlay }: Props) {
  const playing = snapshot.status === 'playing' || snapshot.status === 'buffering';
  return (
    <div className="ladder" role="group" aria-label="Listen length">
      {LISTEN_STEPS.map((s) => (
        <button
          key={s}
          type="button"
          className={cls('ladder-btn', playing && snapshot.clipSeconds === s && 'is-playing', s === maxListenSec && 'is-longest')}
          disabled={disabled}
          onClick={() => onPlay(s)}
          aria-label={`Play ${s} second${s > 1 ? 's' : ''}, adds ${LISTEN_SURCHARGE_PCT[s]} percent`}
        >
          <span className="ladder-sec">{s}s</span>
          <span className="ladder-pct">+{LISTEN_SURCHARGE_PCT[s]}%</span>
        </button>
      ))}
    </div>
  );
}
