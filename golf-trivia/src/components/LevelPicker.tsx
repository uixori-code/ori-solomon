import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LEVELS } from '../config';
import { selectCurrentTeam, selectRemainingAtLevel, useGameStore } from '../store';
import type { Level } from '../types';
import { TeamTag } from './TeamTag';

const LEVEL_INFO: Record<Level, { name: string; views: string }> = {
  1: { name: 'Mega hits', views: 'huge views' },
  2: { name: 'Big hits', views: 'high views' },
  3: { name: 'Familiar', views: 'mid views' },
  4: { name: 'Deep cuts', views: 'low views' },
  5: { name: 'Obscure', views: 'tiny views' },
};

export function LevelPicker() {
  const team = useGameStore(selectCurrentTeam);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const endGame = useGameStore((s) => s.endGame);
  const remaining = useGameStore(useShallow((s) => LEVELS.map((level) => selectRemainingAtLevel(s, level))));
  const [message, setMessage] = useState<string | null>(null);

  if (!team) return null;

  const pick = (level: Level) => {
    setMessage(selectLevel(level) ? null : `No songs left at level ${level}. Pick another level.`);
  };

  return (
    <div className="panel stage-panel">
      <p className="turn-label">
        <TeamTag id={team.id} name={team.name} /> <span>choose a difficulty</span>
      </p>

      <div className="levels">
        {LEVELS.map((level, i) => (
          <button
            key={level}
            type="button"
            className="level-btn"
            data-level={level}
            disabled={remaining[i] === 0}
            onClick={() => pick(level)}
            aria-label={`Level ${level}, ${LEVEL_INFO[level].name}, ${LEVEL_INFO[level].views}`}
          >
            <span className="level-num">{level}</span>
            <span className="level-name">{LEVEL_INFO[level].name}</span>
            <span className="level-views">{remaining[i] === 0 ? 'none left' : LEVEL_INFO[level].views}</span>
            <span className="level-cost" aria-hidden="true">
              {LEVELS.map((n) => (
                <i key={n} className={n <= 6 - level ? 'on' : ''} />
              ))}
            </span>
          </button>
        ))}
      </div>

      <div className="scale" aria-hidden="true">
        <span>huge views = costly, easy</span>
        <span>small views = cheap, hard</span>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {remaining.every((n) => n === 0) && (
        <div className="notice" role="status">
          No songs are left at any level.{' '}
          <button type="button" className="link-btn inline" onClick={endGame}>
            End the game and show the results
          </button>
        </div>
      )}
    </div>
  );
}
