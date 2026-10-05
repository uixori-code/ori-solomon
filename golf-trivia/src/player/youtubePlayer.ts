import type { Emit, PlayerController } from './types';

// Minimal typing for the parts of the YouTube IFrame API we use.
interface YTPlayer {
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getPlayerState(): number;
}
interface YTNamespace {
  Player: new (el: HTMLElement, options: object) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const ENDED = 0;
const PLAYING = 1;
const TICK_MS = 30;
/** If a clip hasn't started playing after this long, report it instead of waiting forever. */
const START_TIMEOUT_MS = 8000;

const ERROR_MESSAGES: Record<number, string> = {
  2: 'The video link is invalid.',
  5: 'The video player hit an error.',
  100: 'The video was removed or is private.',
  101: 'The video owner does not allow embedding.',
  150: 'The video owner does not allow embedding.',
};

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      apiPromise = null;
      reject(new Error('Could not load the YouTube player. Are you online?'));
    };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * One persistent, invisible YouTube player (off-screen, opacity 0, 200x200 px which is YouTube's
 * minimum size), so no title, thumbnail or video is ever on screen. Clips are timed by counting
 * only the time the player is actually in the PLAYING state, so buffering never eats a clip.
 */
export function createYouTubeController(emit: Emit): PlayerController {
  // Vite hot reload re-runs this module: drop any player left behind by the previous run.
  document.querySelectorAll('.yt-hidden').forEach((el) => el.remove());
  const host = document.createElement('div');
  host.className = 'yt-hidden';
  host.setAttribute('aria-hidden', 'true');
  const mount = document.createElement('div');
  host.appendChild(mount);
  document.body.appendChild(host);

  let player: YTPlayer | null = null;
  let ready = false;
  let fatal: string | null = null;
  let pendingVideoId: string | null = null;
  let clip: { seconds: number; playedMs: number; lastTick: number } | null = null;
  let ticker: number | undefined;
  let startWatchdog: number | undefined;

  const clearTimers = () => {
    if (ticker !== undefined) window.clearInterval(ticker);
    if (startWatchdog !== undefined) window.clearTimeout(startWatchdog);
    ticker = undefined;
    startWatchdog = undefined;
  };

  const pause = () => {
    try {
      player?.pauseVideo();
    } catch {
      /* the player may be mid-reload; nothing to pause */
    }
  };

  const finishClip = (elapsedMs: number) => {
    clearTimers();
    clip = null;
    pause();
    emit({ status: 'ready', elapsedMs });
  };

  const fail = (message: string) => {
    clearTimers();
    clip = null;
    pause();
    emit({ status: 'error', error: message });
  };

  const tick = () => {
    if (!clip || !player) return;
    const now = performance.now();
    const isPlaying = player.getPlayerState() === PLAYING;
    if (isPlaying) clip.playedMs += now - clip.lastTick;
    clip.lastTick = now;
    if (clip.playedMs >= clip.seconds * 1000) {
      finishClip(clip.seconds * 1000);
    } else {
      emit({ status: isPlaying ? 'playing' : 'buffering', elapsedMs: clip.playedMs });
    }
  };

  emit({ status: 'loading', error: null });

  loadYouTubeApi()
    .then(() => {
      player = new window.YT!.Player(mount, {
        width: 200,
        height: 200,
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ready = true;
            if (pendingVideoId) player?.cueVideoById(pendingVideoId);
            pendingVideoId = null;
            emit({ status: 'ready', error: null });
          },
          onStateChange: (e: { data: number }) => {
            if (!clip) return;
            if (e.data === PLAYING && startWatchdog !== undefined) {
              window.clearTimeout(startWatchdog);
              startWatchdog = undefined;
            }
            if (e.data === ENDED) finishClip(clip.playedMs); // video shorter than the clip
          },
          onError: (e: { data: number }) => {
            fail(ERROR_MESSAGES[e.data] ?? `The video can't be played (error ${e.data}).`);
          },
        },
      });
    })
    .catch((err: Error) => {
      fatal = err.message;
      emit({ status: 'error', error: fatal });
    });

  return {
    load(videoId) {
      clearTimers();
      clip = null;
      if (fatal) {
        emit({ status: 'error', error: fatal });
        return;
      }
      emit({ status: ready ? 'ready' : 'loading', clipSeconds: null, elapsedMs: 0, error: null });
      if (ready && player) player.cueVideoById(videoId);
      else pendingVideoId = videoId;
    },

    play(seconds) {
      if (!ready || !player) return;
      clearTimers();
      clip = { seconds, playedMs: 0, lastTick: performance.now() };
      emit({ status: 'buffering', clipSeconds: seconds, elapsedMs: 0, error: null });
      player.seekTo(0, true);
      player.playVideo();
      ticker = window.setInterval(tick, TICK_MS);
      startWatchdog = window.setTimeout(
        () => fail("Playback didn't start. The video may be unavailable, or the browser blocked audio."),
        START_TIMEOUT_MS,
      );
    },

    stop() {
      clearTimers();
      clip = null;
      pause();
      if (!fatal) emit({ status: ready ? 'ready' : 'loading', clipSeconds: null, elapsedMs: 0 });
    },
  };
}
