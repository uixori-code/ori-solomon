import type { Emit, PlayerController } from './types';

/** Silent stand-in for the YouTube player (open the app with ?player=sim). Same clip timing, no audio. */
export function createSimController(emit: Emit): PlayerController {
  let timer: number | undefined;
  const clear = () => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  emit({ status: 'ready', error: null });

  return {
    load() {
      clear();
      emit({ status: 'ready', clipSeconds: null, elapsedMs: 0, error: null });
    },
    play(seconds) {
      clear();
      const started = performance.now();
      emit({ status: 'playing', clipSeconds: seconds, elapsedMs: 0, error: null });
      timer = window.setInterval(() => {
        const elapsed = performance.now() - started;
        if (elapsed >= seconds * 1000) {
          clear();
          emit({ status: 'ready', elapsedMs: seconds * 1000 });
        } else {
          emit({ elapsedMs: elapsed });
        }
      }, 30);
    },
    stop() {
      clear();
      emit({ status: 'ready', clipSeconds: null, elapsedMs: 0 });
    },
  };
}
