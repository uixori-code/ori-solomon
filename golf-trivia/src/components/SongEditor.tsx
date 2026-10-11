import { useEffect, useMemo, useState } from 'react';
import { categoryLabel } from '../categoryLabel';
import { loadSongs } from '../data/songSource';
import { saveStartSec } from '../data/supabaseSongs';
import { formatViewsCompact } from '../format';
import { player, usePlayerSnapshot } from '../player';
import type { Song } from '../types';
import { parseVideoId } from '../youtube';

type Note = { kind: 'ok' | 'err'; text: string };

/** Host page (open with ?editor=1): find a song, test-play it, and fix the second the music starts. */
export function SongEditor() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isTest, setIsTest] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const snapshot = usePlayerSnapshot();

  useEffect(() => {
    player.init();
    loadSongs()
      .then((r) => {
        setSongs([...r.songs].sort((a, b) => a.number - b.number));
        setIsTest(r.isTest);
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
    return () => player.stop();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.songName.toLowerCase().includes(q) || String(s.number) === q);
  }, [songs, query]);

  const startOf = (s: Song) => drafts[s.id] ?? String(s.startSec ?? 0);

  const testPlay = (s: Song) => {
    const id = parseVideoId(s.embedUrl);
    if (!id) return setNotes((n) => ({ ...n, [s.id]: { kind: 'err', text: 'No playable video link.' } }));
    setTesting(s.id);
    player.load(id);
    // The player needs a moment to cue the video before it can play.
    window.setTimeout(() => player.play(8, Math.max(0, Number(startOf(s)) || 0)), 700);
  };

  const save = async (s: Song) => {
    const sec = Number(startOf(s));
    if (!Number.isFinite(sec) || sec < 0) return setNotes((n) => ({ ...n, [s.id]: { kind: 'err', text: 'Enter 0 or more seconds.' } }));
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (isTest || !url || !key) return setNotes((n) => ({ ...n, [s.id]: { kind: 'err', text: 'Not connected to Supabase (test songs).' } }));
    try {
      await saveStartSec(url, key, s.id, sec);
      setSongs((all) => all.map((x) => (x.id === s.id ? { ...x, startSec: sec } : x)));
      setDrafts((d) => {
        const { [s.id]: _gone, ...rest } = d;
        return rest;
      });
      setNotes((n) => ({ ...n, [s.id]: { kind: 'ok', text: 'Saved' } }));
    } catch (err) {
      setNotes((n) => ({ ...n, [s.id]: { kind: 'err', text: err instanceof Error ? err.message : String(err) } }));
    }
  };

  return (
    <div className="app editor">
      <header className="header">
        <div className="brand">
          <h1>Song editor</h1>
        </div>
        <div className="header-right">
          <a className="btn" href={window.location.pathname}>
            ← Back to the game
          </a>
        </div>
      </header>

      <section className="panel">
        <p className="muted">
          Test-play a song for 8 seconds from its start second, then save the second the music really starts. Songs that
          fail to play show an error under the song.
        </p>
        <input
          className="editor-search"
          type="search"
          placeholder="Search by title or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search songs"
        />
        {isTest && <p className="notice">These are the test songs; saving needs your Supabase songs.</p>}
        {loadError && (
          <p className="notice notice-error" role="alert">
            {loadError}
          </p>
        )}
        <p className="muted">
          {shown.length} of {songs.length} songs
        </p>

        <ul className="editor-list">
          {shown.map((s) => {
            const note = notes[s.id];
            const playing = testing === s.id && (snapshot.status === 'playing' || snapshot.status === 'buffering');
            const failed = testing === s.id && snapshot.status === 'error';
            return (
              <li key={s.id}>
                <span className="song-no">#{s.number}</span>
                <span className="editor-title" dir="auto">
                  {s.songName}
                  <small>
                    L{s.level} · {s.category ? categoryLabel(s.category) : '-'} · {s.region ?? '-'} · {formatViewsCompact(s.exactViews)}
                  </small>
                  {failed && <small className="err">Can't play: {snapshot.error}</small>}
                  {note && <small className={note.kind === 'ok' ? 'ok' : 'err'}>{note.text}</small>}
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  value={startOf(s)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                  aria-label={`Start second for ${s.songName}`}
                />
                <button type="button" className="btn btn-small" onClick={() => testPlay(s)}>
                  {playing ? '… playing' : '▶ Test'}
                </button>
                <button type="button" className="btn btn-small btn-primary" disabled={drafts[s.id] === undefined} onClick={() => save(s)}>
                  Save
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
