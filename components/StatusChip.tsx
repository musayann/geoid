import type { Fix, Phase } from '@/lib/types';
import { LOW_ACCURACY_M } from '@/lib/format';

interface Props {
  phase: Phase;
  fix?: Fix | null;
  cached?: boolean;
}

export default function StatusChip({ phase, fix = null, cached = false }: Props) {
  if (phase === 'acquiring')
    return (
      <div className="chip">
        <span className="dot searching" />
        SEARCHING
      </div>
    );
  if (phase === 'offline' || cached)
    return (
      <div className="chip">
        <span className="dot" />
        CACHED
      </div>
    );
  if (fix && fix.accuracy > LOW_ACCURACY_M)
    return (
      <div className="chip warn">
        <span className="dot warn" />±{Math.round(fix.accuracy)} M
      </div>
    );
  if (fix)
    return (
      <div className="chip">
        <span className="dot live" />
        GPS · ±{Math.round(fix.accuracy)} M
      </div>
    );
  return (
    <div className="chip">
      <span className="dot" />
      OFF
    </div>
  );
}
