import { cls } from '../cls';
import { MAX_GUESSES } from '../config';

export function GuessPips({ wrongGuesses }: { wrongGuesses: number }) {
  return (
    <div className="pips">
      {Array.from({ length: MAX_GUESSES }, (_, i) => (
        <span key={i} className={cls('pip', i < wrongGuesses && 'is-wrong', i === wrongGuesses && 'is-current')} aria-hidden="true">
          {i < wrongGuesses ? '✗' : ''}
        </span>
      ))}
      <span className="pips-text">
        Guess <b>{wrongGuesses + 1}</b> of {MAX_GUESSES}
      </span>
    </div>
  );
}
