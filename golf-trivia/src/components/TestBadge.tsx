import { player } from '../player';

export function TestBadge() {
  return (
    <span
      className="badge-test"
      title="Phase 1 test data: made-up songs, and one sample video plays for every song."
    >
      TEST MODE
      <span className="badge-test-detail">
        {player.isSimulated ? 'silent simulated player' : 'one sample video plays for every song'}
      </span>
    </span>
  );
}
