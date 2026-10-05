import { useState } from 'react';
import {
  DEFAULT_TEAM_NAMES,
  LISTEN_STEPS,
  LISTEN_SURCHARGE_PCT,
  MAX_GUESSES,
  MAX_ROUNDS,
  MAX_TEAMS,
  MIN_ROUNDS,
  MIN_TEAMS,
  MISS_PENALTY,
  SONG_TIME_LIMIT_SEC,
  WRONG_GUESS_PCT,
} from '../config';
import { formatViews } from '../format';
import { useGameStore } from '../store';
import { cls } from '../cls';
import { teamStyle } from '../teamColors';

export function Setup() {
  const saved = useGameStore((s) => s.setup);
  const songsReady = useGameStore((s) => s.songs.length > 0);
  const startGame = useGameStore((s) => s.startGame);

  const [count, setCount] = useState(Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, saved.teamNames.length)));
  const [names, setNames] = useState(() =>
    Array.from({ length: MAX_TEAMS }, (_, i) => saved.teamNames[i] ?? DEFAULT_TEAM_NAMES[i]),
  );
  const [rounds, setRounds] = useState(saved.maxRounds);

  const setName = (i: number, value: string) => setNames((prev) => prev.map((n, j) => (j === i ? value : n)));
  const clampRounds = (n: number) => Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, n));

  return (
    <div className="setup">
      <form
        className="panel setup-form"
        onSubmit={(e) => {
          e.preventDefault();
          startGame({ teamNames: names.slice(0, count), maxRounds: rounds });
        }}
      >
        <h2>New game</h2>

        <fieldset>
          <legend>Teams</legend>
          <div className="segmented" role="group" aria-label="Number of teams">
            {[2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={cls('segment', count === n && 'is-on')}
                aria-pressed={count === n}
                onClick={() => setCount(n)}
              >
                {n} teams
              </button>
            ))}
          </div>
          <div className="name-fields">
            {names.slice(0, count).map((name, i) => (
              <label key={i} className="name-field" style={teamStyle(i + 1)}>
                <span className="team-dot" aria-hidden="true" />
                <span className="sr-only">Team {i + 1} name</span>
                <input
                  value={name}
                  maxLength={24}
                  placeholder={DEFAULT_TEAM_NAMES[i]}
                  onChange={(e) => setName(i, e.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Rounds</legend>
          <div className="stepper">
            <button type="button" aria-label="Fewer rounds" disabled={rounds <= MIN_ROUNDS} onClick={() => setRounds(clampRounds(rounds - 1))}>
              −
            </button>
            <output aria-live="polite">{rounds}</output>
            <button type="button" aria-label="More rounds" disabled={rounds >= MAX_ROUNDS} onClick={() => setRounds(clampRounds(rounds + 1))}>
              +
            </button>
          </div>
          <p className="muted">
            One round = one turn per team, so {rounds * count} songs this game.
          </p>
        </fieldset>

        <button className="btn btn-primary" type="submit" disabled={!songsReady}>
          {songsReady ? 'Start game' : 'Loading songs…'}
        </button>
      </form>

      <aside className="panel rules">
        <h2>How scoring works</h2>
        <ol>
          <li>
            <b>Lowest total views wins.</b> Every song you get right adds its views to your total.
          </li>
          <li>
            <b>Pick a level.</b> 1 = huge views (costly, easy) … 5 = small views (cheap, hard).
          </li>
          <li>
            <b>Listen in clips:</b> {LISTEN_STEPS.map((s) => `${s}s`).join(' · ')}. The longest clip you play adds{' '}
            {LISTEN_STEPS.map((s) => `${LISTEN_SURCHARGE_PCT[s]}%`).join(' · ')} to the song's views.
          </li>
          <li>
            <b>{MAX_GUESSES} guesses per song.</b> Each wrong guess adds +{WRONG_GUESS_PCT}% to the song's views.
          </li>
          <li>
            <b>Miss all {MAX_GUESSES}</b>
            {SONG_TIME_LIMIT_SEC > 0 && <> or run out of time ({SONG_TIME_LIMIT_SEC}s)</>}: +{formatViews(MISS_PENALTY)} views.
          </li>
        </ol>
      </aside>
    </div>
  );
}
