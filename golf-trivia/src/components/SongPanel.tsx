import { useState } from 'react';
import { cls } from '../cls';
import { categoryLabel } from '../categoryLabel';
import {
  HINT_SURCHARGE_PCT,
  MAX_GUESSES,
  MISS_PENALTY,
  PASS_PENALTY,
  SONG_TIME_LIMIT_SEC,
  type ListenStep,
} from '../config';
import { formatViews } from '../format';
import { player, usePlayerSnapshot } from '../player';
import { saveStartSec } from '../data/supabaseSongs';
import { surchargePercents } from '../scoring';
import { firstGuessStreak, selectCurrentTeam, useGameStore } from '../store';
import { STREAK_BONUS_PCT, STREAK_NEEDED } from '../config';
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
  const setStartSec = useGameStore((s) => s.setStartSec);
  const showHint = useGameStore((s) => s.showHint);
  const passSong = useGameStore((s) => s.passSong);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const pausedAt = useGameStore((s) => s.pausedAt);
  const nextStreak = useGameStore((s) => (s.teams[s.currentTeamIndex] ? firstGuessStreak(s.history, s.teams[s.currentTeamIndex].id) : 0));
  const isTestData = useGameStore((s) => s.isTestData);
  const snapshot = usePlayerSnapshot();
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [confirmPass, setConfirmPass] = useState(false);

  if (!team || !active) return null;

  const { listenPct, wrongPct, hintPct, totalPct } = surchargePercents(active.maxListenSec, active.wrongGuesses, active.hintUsed);
  const heardSomething = active.maxListenSec >= 1;
  const playing = snapshot.status === 'playing' || snapshot.status === 'buffering';
  const playable = snapshot.status === 'ready' || playing;
  const lastGuess = active.wrongGuesses === MAX_GUESSES - 1;
  // Skipping is only for broken videos (or before anything was heard), never a way to dodge a song.
  const canSkip = snapshot.status === 'error' || !heardSomething;
  const progress = snapshot.clipSeconds ? Math.min(1, snapshot.elapsedMs / (snapshot.clipSeconds * 1000)) : 0;

  const hintText = [active.song.category ? categoryLabel(active.song.category) : null, active.song.region ?? null]
    .filter(Boolean)
    .join(' · ');
  const streakOn = active.wrongGuesses === 0 && nextStreak + 1 >= STREAK_NEEDED;
  const lastClip = snapshot.clipSeconds;

  const pause = () => {
    player.stop();
    pauseGame();
  };

  const listen = (seconds: ListenStep) => {
    playClip(seconds);
    player.play(seconds, active.song.startSec ?? 0);
  };

  const applyStart = async () => {
    const sec = Number(startDraft);
    if (startDraft === null || startDraft.trim() === '' || !Number.isFinite(sec) || sec < 0) return;
    setStartSec(sec);
    player.stop();
    setStartDraft(null);
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (isTestData || !url || !key) return setSaveNote('Start set for this game only.');
    try {
      await saveStartSec(url, key, active.song.id, sec);
      setSaveNote('Start saved for this song.');
    } catch (err) {
      setSaveNote(`Set for this game, but not saved (${err instanceof Error ? err.message : err}).`);
    }
  };

  return (
    <div key={active.wrongGuesses} className={cls('panel stage-panel song-panel', active.wrongGuesses > 0 && 'shake')}>
      <div className="song-head">
        <p className="turn-label">
          <TeamTag id={team.id} name={team.name} /> <span>
            Level {active.song.level} · Song <b className="song-no">#{active.song.number}</b>
          </span>
        </p>
        <div className="head-actions">
          <Countdown startedAt={active.startedAt} limitSec={SONG_TIME_LIMIT_SEC} onExpire={failActiveSong} pausedAt={pausedAt} />
          <button type="button" className="icon-btn" onClick={pause} aria-label="Pause the game" title="Pause">
            ⏸
          </button>
        </div>
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
          <button
            type="button"
            className="link-btn replay-btn"
            disabled={!playable || !lastClip}
            onClick={() => lastClip && listen(lastClip as ListenStep)}
          >
            ↻ Replay last clip{lastClip ? ` (${lastClip}s)` : ''}
          </button>
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

      <div className="start-row">
        <label className="block-label" htmlFor="start-sec">Music starts at</label>
        <input
          id="start-sec"
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          value={startDraft ?? String(active.song.startSec ?? 0)}
          onChange={(e) => setStartDraft(e.target.value)}
        />
        <span className="muted">sec</span>
        <button type="button" className="link-btn" disabled={startDraft === null} onClick={applyStart}>
          Set start
        </button>
        {saveNote && <small className="muted" role="status">{saveNote}</small>}
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
              +{listenPct}% listen · +{wrongPct}% wrong{hintPct > 0 && ` · +${hintPct}% hint`} = <strong>+{totalPct}% on views</strong>
              {streakOn && <span className="streak-note"> 🔥 streak: −{STREAK_BONUS_PCT}% if solved now</span>}
            </span>
          ) : (
            <span className="muted">play a clip first</span>
          )}
        </div>
      </div>

      <div className="hint-row">
        {active.hintUsed ? (
          <p className="hint-chip" role="status">
            💡 Hint: <b>{hintText}</b>
          </p>
        ) : (
          <button type="button" className="btn btn-small" disabled={!hintText} onClick={showHint}>
            💡 Hint: genre &amp; region (+{HINT_SURCHARGE_PCT}%)
          </button>
        )}
        {confirmPass ? (
          <span className="pass-confirm">
            Pass costs <b>+{formatViews(PASS_PENALTY)}</b> and shows the song.
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => {
                setConfirmPass(false);
                passSong();
              }}
            >
              Yes, pass
            </button>
            <button type="button" className="btn btn-small" onClick={() => setConfirmPass(false)}>
              Keep playing
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => setConfirmPass(true)}>
            ⏭ Pass (+{formatViews(PASS_PENALTY)})
          </button>
        )}
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
