import { useEffect, useRef, useState } from 'react';
import { History } from './components/History';
import { Header } from './components/Header';
import { LevelPicker } from './components/LevelPicker';
import { RevealPanel } from './components/RevealPanel';
import { Scoreboard } from './components/Scoreboard';
import { Setup } from './components/Setup';
import { SongPanel } from './components/SongPanel';
import { SongEditor } from './components/SongEditor';
import { WinnerScreen } from './components/WinnerScreen';
import { loadSongs } from './data/songSource';
import { validateSongs } from './data/validate';
import { player } from './player';
import { playSfx } from './sound';
import { useGameStore } from './store';
import { parseVideoId } from './youtube';

const isEditor = new URLSearchParams(window.location.search).get('editor') === '1';

/** Plays the sound cues that follow the game: wrong guesses, results and the final win. */
function useGameSounds() {
  const phase = useGameStore((s) => s.phase);
  const outcome = useGameStore((s) => s.lastResult?.outcome);
  const wrongGuesses = useGameStore((s) => s.active?.wrongGuesses ?? 0);
  const prevWrong = useRef(wrongGuesses);
  const prevPhase = useRef(phase);

  useEffect(() => {
    if (wrongGuesses > prevWrong.current) playSfx('wrong');
    prevWrong.current = wrongGuesses;
  }, [wrongGuesses]);

  useEffect(() => {
    // Only on a real change of phase, so reopening a saved game doesn't blare a result.
    if (prevPhase.current !== phase) {
      if (phase === 'revealed') playSfx(outcome === 'solved' ? 'correct' : outcome === 'passed' ? 'pass' : 'fail');
      if (phase === 'gameOver') playSfx('win');
    }
    prevPhase.current = phase;
  }, [phase, outcome]);
}

export default function App() {
  return isEditor ? <SongEditor /> : <Game />;
}

function Game() {
  useGameSounds();
  const pausedAt = useGameStore((s) => s.pausedAt);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const phase = useGameStore((s) => s.phase);
  const setSongs = useGameStore((s) => s.setSongs);
  const embedUrl = useGameStore((s) => s.active?.song.embedUrl ?? null);
  const songId = useGameStore((s) => s.active?.song.id ?? null);
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Load the song list, and start the YouTube API loading in the background.
  useEffect(() => {
    player.init();
    loadSongs()
      .then(({ songs, isTest, notice: loadNotice, problems }) => {
        setSongs(songs, isTest);
        setNotice(loadNotice);
        setIssues([...problems, ...validateSongs(songs)]);
      })
      .catch((err: unknown) => setNotice(`Couldn't load the songs: ${err instanceof Error ? err.message : String(err)}`));
  }, [setSongs]);

  // Cue the hidden player as soon as a song is drawn.
  useEffect(() => {
    if (!embedUrl) return;
    const videoId = parseVideoId(embedUrl);
    if (videoId) player.load(videoId);
    else player.fail('This song has no playable video link.');
  }, [songId, embedUrl]);

  // Silence the player whenever a song stops being the live one.
  useEffect(() => {
    if (phase !== 'listening') player.stop();
  }, [phase]);

  return (
    <div className="app">
      <Header />

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {issues.length > 0 && (
        <div className="notice notice-error" role="alert">
          <b>Songs left out because of data problems ({issues.length}):</b>
          <ul>
            {issues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {issues.length > 4 && <p>…and {issues.length - 4} more.</p>}
        </div>
      )}

      {phase === 'setup' ? (
        <Setup />
      ) : (
        <main className="board">
          <section className="stage" aria-label="Current turn">
            {phase === 'pickLevel' && <LevelPicker />}
            {phase === 'listening' && <SongPanel />}
            {phase === 'revealed' && <RevealPanel />}
            {phase === 'gameOver' && <WinnerScreen />}
          </section>
          <div className="sidebar">
            {phase !== 'gameOver' && <Scoreboard />}
            <History />
          </div>
        </main>
      )}
      {pausedAt !== null && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Game paused">
          <div className="pause-card">
            <p className="pause-title">⏸ Paused</p>
            <p className="muted">The song timer is frozen and the music is stopped.</p>
            <button type="button" className="btn btn-primary" onClick={resumeGame} autoFocus>
              ▶ Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
