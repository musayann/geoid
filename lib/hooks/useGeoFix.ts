'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoordFormat, Fix, Phase } from '@/lib/types';
import { reverseGeocode, lookupElevation } from '@/lib/geo';

const REFRESH_COOLDOWN_MS = 1500;
const STORE_KEY = 'wai:last-fix';

export interface AppState {
  phase: Phase;
  fix: Fix | null;
  fmt: CoordFormat;
  cached: boolean;
  error: string;
}

/* ---- persistence ------------------------------------------ */
function loadStored(): Fix | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
}
function saveStored(fix: Fix) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(fix));
  } catch {
    /* private mode */
  }
}

/* ============================================================
   useGeoFix — the geolocation state machine.

   Owns the phase/fix state, acquires and refreshes the position,
   reverse-geocodes + resolves elevation, persists the last fix,
   and reacts to online/offline transitions. A 30s tick keeps the
   relative-time labels honest while a fix is on screen.
   ============================================================ */
export function useGeoFix() {
  const [state, setStateRaw] = useState<AppState>({
    phase: 'acquiring',
    fix: null,
    fmt: 'dd',
    cached: false,
    error: '',
  });
  const [, setTick] = useState(0); // forces re-render so relative time stays honest

  const setState = useCallback(
    (patch: Partial<AppState>) => setStateRaw((s) => ({ ...s, ...patch })),
    [],
  );

  const acquireToken = useRef(0);
  const lastRefresh = useRef(0);

  /* ---- acquisition ---------------------------------------- */
  const onPosition = useCallback(
    async (pos: GeolocationPosition) => {
      const c = pos.coords;
      // A real GPS altitude always comes with a finite altitudeAccuracy. Some
      // devices/browsers report altitude: 0 (not null) when they have no vertical
      // fix — trusting that would show a bogus "0 m" and skip the terrain fallback.
      const gpsAlt =
        Number.isFinite(c.altitude) && Number.isFinite(c.altitudeAccuracy)
          ? (c.altitude as number)
          : null;
      const fix: Fix = {
        lat: c.latitude,
        lon: c.longitude,
        accuracy: c.accuracy,
        altitude: gpsAlt,
        altSource: gpsAlt != null ? 'GPS' : null,
        place: null,
        updatedAt: Date.now(),
      };

      // Stay on the "Finding you…" acquiring screen until the address (and
      // elevation) resolve, so the live card appears once, fully populated —
      // no flicker from coordinates landing before the place name.
      const token = acquireToken.current;
      const [place, elevation] = await Promise.all([
        reverseGeocode(fix.lat, fix.lon).catch(() => null),
        fix.altitude == null
          ? lookupElevation(fix.lat, fix.lon).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (token !== acquireToken.current) return; // superseded by a newer fix

      const enriched: Fix = { ...fix, place };
      if (enriched.altitude == null && elevation != null) {
        enriched.altitude = elevation;
        enriched.altSource = 'terrain model';
      }
      saveStored(enriched);
      setState({ phase: 'live', fix: enriched, cached: false, error: '' });
    },
    [setState],
  );

  const onPositionError = useCallback(
    (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setState({ phase: 'denied' });
        return;
      }
      const stored = loadStored();
      if (stored) {
        setState({ phase: 'offline', fix: stored, cached: true });
        return;
      }
      const msg =
        err.code === err.TIMEOUT
          ? 'Timed out waiting for a fix. Head outdoors or into open sky and try again.'
          : 'Your location is temporarily unavailable. Try again in a moment.';
      setState({ phase: 'error', error: msg });
    },
    [setState],
  );

  const acquire = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
    lastRefresh.current = now;

    if (!('geolocation' in navigator)) {
      setState({ phase: 'unsupported' });
      return;
    }

    const token = ++acquireToken.current;
    const stored = loadStored();

    // Offline: no point asking for a fresh fix — show the last known one.
    if (!navigator.onLine && stored) {
      setState({ phase: 'offline', fix: stored, cached: true });
      return;
    }

    setState({ phase: 'acquiring' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (token === acquireToken.current) onPosition(pos);
      },
      (err) => {
        if (token === acquireToken.current) onPositionError(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [setState, onPosition, onPositionError]);

  const refresh = useCallback(() => {
    lastRefresh.current = 0;
    acquire();
  }, [acquire]);

  const cycleFmt = useCallback(() => {
    setStateRaw((s) => ({ ...s, fmt: s.fmt === 'dd' ? 'dms' : 'dd' }));
  }, []);

  /* ---- lifecycle ------------------------------------------ */
  useEffect(() => {
    acquire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setStateRaw((s) => {
        if (s.phase === 'offline' || s.phase === 'error') refresh();
        return s;
      });
    };
    const onOffline = () =>
      setStateRaw((s) => (s.fix ? { ...s, phase: 'offline', cached: true } : s));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  useEffect(() => {
    if (state.phase !== 'live' && state.phase !== 'offline') return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [state.phase]);

  return { state, refresh, cycleFmt };
}
