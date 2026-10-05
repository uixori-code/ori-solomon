import { useEffect, useState } from 'react';
import { History } from './components/History';
import { Header } from './components/Header';
import { LevelPicker } from './components/LevelPicker';
import { RevealPanel } from './components/RevealPanel';
import { Scoreboard } from './components/Scoreboard';
import { Setup } from './components/Setup';
import { SongPanel } from './components/SongPanel';
import { WinnerScreen } from './components/WinnerScreen';
import { loadSongs } from './data/songSource';
import { validateSongs } from './data/validate';
import { player } from './player';
import { useGameStore } from './store';
import { parseVideoId } from './youtube';

export default function App() {
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
    </div>
  );
}
