import { useSyncExternalStore } from 'react';

/** Little synthesised sound effects (no audio files): the Web Audio API makes every note. */
export type Sfx = 'correct' | 'wrong' | 'fail' | 'pass' | 'tick' | 'win' | 'click';

const KEY = 'golf-trivia-sound';
const readOn = () => {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
};

let on = readOn();
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

interface Note {
  /** Hz */
  f: number;
  /** start offset, seconds */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const SONGS: Record<Sfx, Note[]> = {
  correct: [
    { f: 523, at: 0, dur: 0.12 },
    { f: 659, at: 0.1, dur: 0.12 },
    { f: 784, at: 0.2, dur: 0.12 },
    { f: 1047, at: 0.3, dur: 0.35 },
  ],
  wrong: [
    { f: 220, at: 0, dur: 0.18, type: 'sawtooth', gain: 0.5 },
    { f: 165, at: 0.16, dur: 0.3, type: 'sawtooth', gain: 0.5 },
  ],
  fail: [
    { f: 392, at: 0, dur: 0.2, type: 'triangle' },
    { f: 330, at: 0.2, dur: 0.2, type: 'triangle' },
    { f: 262, at: 0.4, dur: 0.2, type: 'triangle' },
    { f: 196, at: 0.6, dur: 0.5, type: 'triangle' },
  ],
  pass: [
    { f: 440, at: 0, dur: 0.12, type: 'triangle' },
    { f: 330, at: 0.12, dur: 0.25, type: 'triangle' },
  ],
  tick: [{ f: 1200, at: 0, dur: 0.05, type: 'square', gain: 0.25 }],
  click: [{ f: 800, at: 0, dur: 0.04, type: 'triangle', gain: 0.3 }],
  win: [
    { f: 523, at: 0, dur: 0.15 },
    { f: 659, at: 0.15, dur: 0.15 },
    { f: 784, at: 0.3, dur: 0.15 },
    { f: 1047, at: 0.45, dur: 0.15 },
    { f: 784, at: 0.65, dur: 0.12 },
    { f: 1047, at: 0.8, dur: 0.5 },
  ],
};

export function playSfx(name: Sfx): void {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime;
    for (const n of SONGS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f;
      const peak = (n.gain ?? 0.7) * 0.25;
      gain.gain.setValueAtTime(0, start + n.at);
      gain.gain.linearRampToValueAtTime(peak, start + n.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + n.at);
      osc.stop(start + n.at + n.dur + 0.02);
    }
  } catch {
    /* no audio available: the game is silent, nothing else changes */
  }
}

export function setSoundOn(value: boolean): void {
  on = value;
  try {
    window.localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const useSoundOn = (): boolean =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
