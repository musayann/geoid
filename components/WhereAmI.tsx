'use client';

/* ============================================================
   Where Am I — a glanceable "where are you" card.

   Thin container: the geolocation state machine (useGeoFix) and
   toast/clipboard (useToast) live in hooks, and each app phase
   renders as its own component. This just wires them together.
   ============================================================ */

import { useToast } from '@/lib/hooks/useToast';
import { useGeoFix } from '@/lib/hooks/useGeoFix';
import Toast from './Toast';
import AcquiringCard from './AcquiringCard';
import DeniedCard from './DeniedCard';
import UnsupportedCard from './UnsupportedCard';
import ErrorCard from './ErrorCard';
import LocationCard from './LocationCard';

export default function WhereAmI() {
  const { toast, copy } = useToast();
  const { state, refresh, cycleFmt } = useGeoFix();
  const { phase, fix, fmt, cached, error } = state;

  const card = (() => {
    switch (phase) {
      case 'acquiring':
        return <AcquiringCard />;
      case 'denied':
        return <DeniedCard onRetry={refresh} />;
      case 'unsupported':
        return <UnsupportedCard />;
      case 'error':
        return <ErrorCard error={error} onRetry={refresh} />;
      default:
        // 'live' | 'offline' — fall back to the error card if we somehow have no fix.
        if (!fix) return <ErrorCard error={error} onRetry={refresh} />;
        return (
          <LocationCard
            phase={phase}
            fix={fix}
            fmt={fmt}
            cached={cached}
            onCycleFmt={cycleFmt}
            onRefresh={refresh}
            copy={copy}
          />
        );
    }
  })();

  return (
    <>
      {card}
      <Toast msg={toast} />
    </>
  );
}
