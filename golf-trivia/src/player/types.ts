export type PlayerStatus = 'loading' | 'ready' | 'buffering' | 'playing' | 'error';

export interface PlayerSnapshot {
  status: PlayerStatus;
  /** Length of the clip being played (or last played), in seconds. */
  clipSeconds: number | null;
  /** Audio actually played of the current clip, in ms. */
  elapsedMs: number;
  error: string | null;
}

export type Emit = (patch: Partial<PlayerSnapshot>) => void;

export interface PlayerController {
  /** Cue a video. Nothing plays until play() is called. */
  load(videoId: string): void;
  /** Play the first `seconds` seconds of the cued video, then stop. */
  play(seconds: number): void;
  stop(): void;
}
