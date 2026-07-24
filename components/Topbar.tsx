import type { Fix, Phase } from '@/lib/types';
import StatusChip from './StatusChip';

interface Props {
  phase: Phase;
  fix?: Fix | null;
  cached?: boolean;
}

export default function Topbar({ phase, fix = null, cached = false }: Props) {
  return (
    <div className="topbar">
      <div className="wordmark">WHERE AM I</div>
      <StatusChip phase={phase} fix={fix} cached={cached} />
    </div>
  );
}
