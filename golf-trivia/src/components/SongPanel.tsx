import { cls } from '../cls';
import {
  MAX_GUESSES,
  MISS_PENALTY,
  SONG_TIME_LIMIT_SEC,
  type ListenStep,
} from '../config';
import { formatViews } from '../format';
import { player, usePlayerSnapshot } from '../player';
import { surchargePercents } from '../scoring';
import { selectCurrentTeam, useGameStore } from '../store';
import { Countdown } from './Countdown';
import { GuessPips } from './GuessPips';
import { ListenLadder } from './ListenLadder';
import { TeamTag } from './TeamTag';

/** The hidden-song panel: nothing here identifies the song (no title, thumbnail or video). */
export function SongPanel() {
  const team = useGameStore(selectCurrentTeam);
  const active = useGameStore((s) => s.active);
  const playClip = useGameStore((s) => s.playClip);
  const handleGuess = useGameStore((s) => s.handleGuess);
  const failActiveSong = useGameStore((s) => s.failActiveSong);
  const skipUnplayable = useGameStore((s) => s.skipUnplayable);
  const snapshot = usePlayerSnapshot();

  if (!team || !active) return null;

  const { listenPct, wrongPct, totalPct } = surchargePercents(active.maxListenSec, active.wrongGuesses);
  const heardSomething = active.maxListenSec >= 1;
  const playing = snapshot.status === 'playing' || snapshot.status === 'buffering';
  const playable = snapshot.status === 'ready' || playing;
  const lastGuess = active.wrongGuesses === MAX_GUESSES - 1;
  // Skipping is only for broken videos (or before anything was heard), never a way to dodge a song.
  const canSkip = snapshot.status === 'error' || !heardSomething;
  const progress = snapshot.clipSeconds ? Math.min(1, snapshot.elapsedMs / (snapshot.clipSeconds * 1000)) : 0;

  const listen = (seconds: ListenStep) => {
    playClip(seconds);
    player.play(seconds);
  };

  return (
    <div className="panel stage-panel song-panel">
      <div className="song-head">
        <p className="turn-label">
          <TeamTag id={team.id} name={team.name} /> <span>Level {active.song.level}</span>
        </p>
        <Countdown startedAt={active.startedAt} limitSec={SONG_TIME_LIMIT_SEC} onExpire={failActiveSong} />
      </div>

      <div className="mystery" aria-live="polite">
        <div className={cls('eq', playing && 'is-on')} aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 5) * 90}ms` }} />
          ))}
        </div>
        <p className="mystery-title" aria-hidden="true">
          ? ? ?
        </p>
        <p className="muted mystery-sub">
          {snapshot.status === 'loading'
            ? 'Loading player…'
            : snapshot.status === 'buffering'
              ? 'Starting…'
              : playing
                ? 'Listen…'
                : heardSomething
                  ? 'Replay a clip or make a guess'
                  : 'Press a clip length to start listening'}
        </p>
      </div>

      <div className="listen-block">
        <div className="block-head">
          <span className="block-label">Listen</span>
          <span className="longest">
            {heardSomething ? (
              <>
                longest played: <b>{active.maxListenSec}s</b>
              </>
            ) : (
              'nothing played yet'
            )}
          </span>
        </div>
        <ListenLadder maxListenSec={active.maxListenSec} snapshot={snapshot} disabled={!playable} onPlay={listen} />
        <div className="progress" role="progressbar" aria-label="Clip progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="status-row">
        <div className="status-cell">
          <span className="block-label">Guesses</span>
          <GuessPips wrongGuesses={active.wrongGuesses} />
        </div>
        <div className="status-cell cost">
          <span className="block-label">Cost if correct now</span>
          {heardSomething ? (
            <span>
              +{listenPct}% listen · +{wrongPct}% wrong = <strong>+{totalPct}% on views</strong>
            </span>
          ) : (
            <span className="muted">play a clip first</span>
          )}
        </div>
      </div>

      {active.wrongGuesses > 0 && (
        <p key={active.wrongGuesses} className="toast" role="status">
          ✗ Wrong. Guess {active.wrongGuesses + 1} of {MAX_GUESSES}, +{wrongPct}% added so far.
        </p>
      )}

      {snapshot.status === 'error' && (
        <p className="notice notice-error" role="alert">
          This video can't be played: {snapshot.error}
        </p>
      )}

      <div className="judge-row">
        <button
          type="button"
          className="judge judge-yes"
          disabled={!heardSomething}
          onClick={() => handleGuess(team.id, true, active.song.exactViews)}
        >
          <span aria-hidden="true">✓</span> Correct
        </button>
        <button
          type="button"
          className="judge judge-no"
          disabled={!heardSomething}
          onClick={() => handleGuess(team.id, false, active.song.exactViews)}
        >
          <span aria-hidden="true">✗</span> Wrong
          {lastGuess && <small>last guess: song fails, +{formatViews(MISS_PENALTY)}</small>}
        </button>
      </div>

      {canSkip && (
        <button type="button" className="link-btn" onClick={skipUnplayable}>
          Can't play this one? Skip song (no cost)
        </button>
      )}
    </div>
  );
}
