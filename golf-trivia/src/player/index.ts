import { useSyncExternalStore } from 'react';
import { createSimController } from './simPlayer';
import type { Emit, PlayerController, PlayerSnapshot } from './types';
import { createYouTubeController } from './youtubePlayer';

export type { PlayerSnapshot } from './types';

const simulated = new URLSearchParams(window.location.search).get('player') === 'sim';

let snapshot: PlayerSnapshot = { status: 'loading', clipSeconds: null, elapsedMs: 0, error: null };
const listeners = new Set<() => void>();

const emit: Emit = (patch) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

let controller: PlayerController | null = null;
const ctl = () => (controller ??= simulated ? createSimController(emit) : createYouTubeController(emit));

/** The app's single hidden player. Created on first use; call init() early so the YouTube API loads in the background. */
export const player = {
  /** True when running with ?player=sim (silent simulated player). */
  isSimulated: simulated,
  init: () => void ctl(),
  load: (videoId: string) => ctl().load(videoId),
  play: (seconds: number) => ctl().play(seconds),
  stop: () => controller?.stop(),
  /** Report that the current song has nothing playable (bad or missing embed URL). */
  fail: (message: string) => emit({ status: 'error', error: message }),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePlayerSnapshot = (): PlayerSnapshot => useSyncExternalStore(subscribe, () => snapshot);
