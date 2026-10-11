import { useMemo } from 'react';

const COLORS = ['#ffc531', '#ff5d6c', '#4be37a', '#56b4e9', '#ffffff', '#cc79a7'];

/** A burst of falling paper pieces. Pure CSS; hidden for people who ask for reduced motion. */
export function Confetti({ pieces = 48 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 160,
        color: COLORS[i % COLORS.length],
        spin: Math.random() * 720 - 360,
      })),
    [pieces],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              left: `${b.left}%`,
              background: b.color,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              '--drift': `${b.drift}px`,
              '--spin': `${b.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
