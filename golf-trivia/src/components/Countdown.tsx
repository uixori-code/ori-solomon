import { useEffect, useState } from 'react';
import { cls } from '../cls';
import { formatClock } from '../format';

interface Props {
  /** Epoch ms of the first listen; null until the team has listened once. */
  startedAt: number | null;
  limitSec: number;
  onExpire: () => void;
}

const WARN_AT_SEC = 10;

export function Countdown({ startedAt, limitSec, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || limitSec <= 0) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, limitSec]);

  const started = startedAt !== null;
  const remaining = started ? Math.max(0, limitSec - Math.max(0, now - startedAt) / 1000) : limitSec;

  useEffect(() => {
    if (limitSec > 0 && started && remaining <= 0) onExpire();
  }, [limitSec, started, remaining, onExpire]);

  if (limitSec <= 0) return null;

  return (
    <div className={cls('countdown', started && remaining <= WARN_AT_SEC && 'is-warn')} role="timer" aria-label="Time left on this song">
      <span aria-hidden="true">⏱</span> <b>{formatClock(remaining)}</b>
      {!started && <small>starts at first listen</small>}
    </div>
  );
}
