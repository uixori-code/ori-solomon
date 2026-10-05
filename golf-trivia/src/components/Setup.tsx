import { useMemo, useState } from 'react';
import { categoryLabel, sortCategories } from '../categoryLabel';
import {
  DEFAULT_TEAM_NAMES,
  LEVELS,
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
import { filterSongs, useGameStore } from '../store';
import { cls } from '../cls';
import { teamStyle } from '../teamColors';

export function Setup() {
  const saved = useGameStore((s) => s.setup);
  const allSongs = useGameStore((s) => s.allSongs);
  const startGame = useGameStore((s) => s.startGame);

  // Genre and region filters only appear for real data, where songs carry a category and region.
  const categories = useMemo(
    () => sortCategories([...new Set(allSongs.flatMap((s) => (s.category ? [s.category] : [])))]),
    [allSongs],
  );
  const regions = useMemo(
    () => [...new Set(allSongs.flatMap((s) => (s.region ? [s.region] : [])))].sort(),
    [allSongs],
  );
  const [picked, setPicked] = useState<string[] | null>(saved.categories?.length ? saved.categories : null); // null = all
  const [region, setRegion] = useState(saved.region ?? 'all');
  const selectedCategories = picked ?? categories;
  const pool = useMemo(
    () => filterSongs(allSongs, { categories: picked ?? undefined, region }),
    [allSongs, picked, region],
  );
  const perLevel = LEVELS.map((level) => pool.filter((s) => s.level === level).length);
  const songsReady = pool.length > 0;

  const toggleCategory = (category: string) => {
    const next = new Set(selectedCategories);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    if (next.size === 0) return; // at least one genre stays selected
    setPicked(next.size === categories.length ? null : [...next]);
  };

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
          startGame({
            teamNames: names.slice(0, count),
            maxRounds: rounds,
            categories: picked ?? undefined,
            region,
          });
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

        {categories.length > 0 && (
          <fieldset>
            <legend>Genres</legend>
            <div className="chips" role="group" aria-label="Genres to play">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={cls('chip-toggle', selectedCategories.includes(category) && 'is-on')}
                  aria-pressed={selectedCategories.includes(category)}
                  onClick={() => toggleCategory(category)}
                >
                  {categoryLabel(category)}
                  <small>{allSongs.filter((s) => s.category === category).length}</small>
                </button>
              ))}
            </div>
            {regions.length > 1 && (
              <div className="segmented" role="group" aria-label="Region">
                {['all', ...regions].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={cls('segment', region === r && 'is-on')}
                    aria-pressed={region === r}
                    onClick={() => setRegion(r)}
                  >
                    {r === 'all' ? 'All songs' : r}
                  </button>
                ))}
              </div>
            )}
            <p className="muted pool-line">
              {pool.length} playable song{pool.length === 1 ? '' : 's'} ·{' '}
              {LEVELS.map((level, i) => (
                <span key={level} className={perLevel[i] === 0 ? 'is-empty' : undefined}>
                  L{level} {perLevel[i]}
                  {level < 5 ? ' · ' : ''}
                </span>
              ))}
            </p>
          </fieldset>
        )}

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
          {songsReady ? 'Start game' : allSongs.length === 0 ? 'Loading songs…' : 'No songs match'}
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
