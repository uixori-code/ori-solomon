import { teamStyle } from '../teamColors';

export function TeamTag({ id, name }: { id: number; name: string }) {
  return (
    <span className="team-tag" style={teamStyle(id)}>
      <span className="team-dot" aria-hidden="true" />
      {name}
    </span>
  );
}
