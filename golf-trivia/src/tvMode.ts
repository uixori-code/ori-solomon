import { useSyncExternalStore } from 'react';

/** "TV mode": much bigger type for a projector or a shared screen, and full screen when the browser allows it. */
const KEY = 'golf-trivia-tv';
const read = () => {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};

let on = read();
const listeners = new Set<() => void>();
const apply = () => document.documentElement.classList.toggle('tv', on);
apply();

export function setTvMode(value: boolean): void {
  on = value;
  apply();
  try {
    window.localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  try {
    if (value && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    if (!value && document.fullscreenElement) void document.exitFullscreen?.();
  } catch {
    /* full screen is optional */
  }
  listeners.forEach((l) => l());
}

export const useTvMode = (): boolean =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
