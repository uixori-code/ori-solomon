import { useEffect, useState } from 'react';
import { cls } from '../cls';
import { formatClock } from '../format';
import { playSfx } from '../sound';

interface Props {
  /** Epoch ms of the first listen; null until the team has listened once. */
  startedAt: number | null;
  limitSec: number;
  onExpire: () => void;
  /** Epoch ms the host paused at: the clock freezes on that moment. */
  pausedAt?: number | null;
}

const WARN_AT_SEC = 10;

export function Countdown({ startedAt, limitSec, onExpire, pausedAt = null }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || limitSec <= 0 || pausedAt !== null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, limitSec, pausedAt]);

  const started = startedAt !== null;
  const remaining = started ? Math.max(0, limitSec - Math.max(0, (pausedAt ?? now) - startedAt) / 1000) : limitSec;

  useEffect(() => {
    if (limitSec > 0 && started && remaining <= 0) onExpire();
  }, [limitSec, started, remaining, onExpire]);

  // A soft tick every second of the last WARN_AT_SEC.
  const whole = Math.ceil(remaining);
  useEffect(() => {
    if (started && pausedAt === null && whole > 0 && whole <= WARN_AT_SEC) playSfx('tick');
  }, [started, pausedAt, whole]);

  if (limitSec <= 0) return null;

  return (
    <div className={cls('countdown', started && remaining <= WARN_AT_SEC && 'is-warn')} role="timer" aria-label="Time left on this song">
      <span aria-hidden="true">⏱</span> <b>{formatClock(remaining)}</b>
      {!started && <small>starts at first listen</small>}
    </div>
  );
}
