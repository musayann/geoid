import type { Fix, Phase } from '@/lib/types';
import StatusChip from './StatusChip';
import ThemeToggle from './ThemeToggle';

interface Props {
  phase: Phase;
  fix?: Fix | null;
  cached?: boolean;
}

export default function Topbar({ phase, fix = null, cached = false }: Props) {
  return (
    <div className="topbar">
      <div className="wordmark">WHERE AM I</div>
      <div className="topbar-actions">
        <StatusChip phase={phase} fix={fix} cached={cached} />
        <ThemeToggle />
      </div>
    </div>
  );
}
