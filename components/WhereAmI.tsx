'use client';

/* ============================================================
   Where Am I — a glanceable "where are you" card.

   React/Next port of the design "Where Am I.dc.html": live
   geolocation, reverse geocoding + elevation (via our API routes),
   and the acquiring / permission-denied / low-accuracy / offline
   states, with pull-to-refresh, tap-to-copy, DD/DMS and share.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoordFormat, Fix, Phase } from '@/lib/types';
import { reverseGeocode, lookupElevation } from '@/lib/geo';
import {
  LOW_ACCURACY_M,
  clockTime,
  coordText,
  depthForAccuracy,
  metres,
  relTime,
  shareText,
  splitUncertain,
} from '@/lib/format';

const REFRESH_COOLDOWN_MS = 1500;
const STORE_KEY = 'wai:last-fix';
const PULL_THRESHOLD = 60;

interface AppState {
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

export default function WhereAmI() {
  const [state, setStateRaw] = useState<AppState>({
    phase: 'acquiring',
    fix: null,
    fmt: 'dd',
    cached: false,
    error: '',
  });
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0); // forces re-render so relative time stays honest

  const setState = useCallback(
    (patch: Partial<AppState>) => setStateRaw((s) => ({ ...s, ...patch })),
    [],
  );

  const acquireToken = useRef(0);
  const lastRefresh = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ---- toast + clipboard ---------------------------------- */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else throw new Error('no clipboard');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        ta.remove();
      }
      showToast(`Copied — ${label}`);
    },
    [showToast],
  );

  /* ---- acquisition ---------------------------------------- */
  const onPosition = useCallback(
    async (pos: GeolocationPosition) => {
      const c = pos.coords;
      const fix: Fix = {
        lat: c.latitude,
        lon: c.longitude,
        accuracy: c.accuracy,
        altitude: Number.isFinite(c.altitude) ? (c.altitude as number) : null,
        altSource: Number.isFinite(c.altitude) ? 'GPS' : null,
        place: null,
        updatedAt: Date.now(),
      };

      // Show coordinates immediately; enrich with names/elevation as they arrive.
      setState({ phase: 'live', fix, cached: false, error: '' });

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
      setState({ fix: enriched });
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

  /* ---- lifecycle ------------------------------------------ */
  useEffect(() => {
    acquire();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setStateRaw((s) => {
        if (s.phase === 'offline' || s.phase === 'error') refresh();
        return s;
      });
    };
    const onOffline = () => setStateRaw((s) => (s.fix ? { ...s, phase: 'offline', cached: true } : s));
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

  /* ---- pull to refresh ------------------------------------ */
  const sheetRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const pull = useRef<{ startY: number | null; dy: number }>({ startY: null, dy: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    pull.current = { startY: e.clientY, dy: 0 };
    sheetRef.current?.classList.add('dragging');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pull.current;
    if (p.startY == null) return;
    p.dy = Math.max(0, e.clientY - p.startY);
    const y = Math.min(96, p.dy * 0.5);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${y}px)`;
    const h = hintRef.current;
    if (h) {
      h.style.opacity = y > 6 ? '1' : '0';
      h.textContent = y > PULL_THRESHOLD ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH';
    }
  };
  const onPointerEnd = () => {
    const p = pull.current;
    if (p.startY == null) return;
    const trigger = Math.min(96, p.dy * 0.5) > PULL_THRESHOLD;
    pull.current = { startY: null, dy: 0 };
    sheetRef.current?.classList.remove('dragging');
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (hintRef.current) hintRef.current.style.opacity = '0';
    if (trigger) refresh();
  };

  /* ---- actions -------------------------------------------- */
  const share = useCallback(async () => {
    const fix = state.fix;
    if (!fix) return;
    const text = shareText(fix, state.fmt);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Where Am I', text });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    copy(text, 'summary');
  }, [state.fix, state.fmt, copy]);

  const cycleFmt = () => setState({ fmt: state.fmt === 'dd' ? 'dms' : 'dd' });

  const copyPlace = () => {
    const fix = state.fix;
    if (!fix) return;
    const c = coordText(fix, state.fmt);
    const parts = [fix.place?.title, fix.place?.subtitle].filter(Boolean);
    copy(parts.join(', ') || `${c.lat}, ${c.lon}`, 'place');
  };
  const copyCoords = () => {
    if (!state.fix) return;
    const c = coordText(state.fix, state.fmt);
    copy(`${c.lat}, ${c.lon}`, 'coordinates');
  };
  const copyAlt = () => {
    if (state.fix?.altitude != null) copy(`${metres(state.fix.altitude)} m`, 'altitude');
  };
  const copyLevel = (idx: number) => {
    const lv = state.fix?.place?.levels?.[idx];
    if (lv) copy(lv.name, lv.label.toLowerCase());
  };

  /* ========================================================
     Rendering
     ======================================================== */
  const { phase, fix, fmt } = state;

  const statusChip = () => {
    if (phase === 'acquiring')
      return (
        <div className="chip">
          <span className="dot searching" />
          SEARCHING
        </div>
      );
    if (phase === 'offline' || state.cached)
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
  };

  const Topbar = () => (
    <div className="topbar">
      <div className="wordmark">WHERE AM I</div>
      {statusChip()}
    </div>
  );

  /* ---- acquiring ------------------------------------------ */
  if (phase === 'acquiring') {
    return (
      <>
        <main className="card">
          <div className="sheet enter">
            <Topbar />
            <div className="acquire">
              <div className="pulse">
                <div className="ring" />
                <div className="ring delay" />
                <div className="core" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                <h1>Finding you…</h1>
                <div className="sub">READING GPS · REFINING FIX</div>
              </div>
              <div className="bars">
                <i style={{ width: '72%' }} />
                <i style={{ width: '54%' }} />
                <i style={{ width: '63%' }} />
              </div>
            </div>
            <div className="message">
              <div className="fineprint">Usually takes a few seconds outdoors</div>
            </div>
          </div>
        </main>
        <Toast msg={toast} />
      </>
    );
  }

  /* ---- permission denied ---------------------------------- */
  if (phase === 'denied') {
    return (
      <>
        <main className="card">
          <div className="sheet enter">
            <Topbar />
            <div className="message">
              <div className="compass">N·E·S·W</div>
              <h1>We can’t see where you are.</h1>
              <p>
                Where Am I only works with your location. It stays on your device — nothing is stored
                on a server or sent anywhere.
              </p>
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={refresh}>
                Allow location access
              </button>
              <div className="fineprint">
                Enable location for this site in your browser settings, then retry
              </div>
            </div>
          </div>
        </main>
        <Toast msg={toast} />
      </>
    );
  }

  /* ---- unsupported ---------------------------------------- */
  if (phase === 'unsupported') {
    return (
      <>
        <main className="card">
          <div className="sheet enter">
            <Topbar />
            <div className="message">
              <div className="compass">N·E·S·W</div>
              <h1>Location isn’t available here.</h1>
              <p>This browser doesn’t support geolocation. Try a modern mobile browser over HTTPS.</p>
            </div>
          </div>
        </main>
        <Toast msg={toast} />
      </>
    );
  }

  /* ---- error ---------------------------------------------- */
  if (phase === 'error' || !fix) {
    return (
      <>
        <main className="card">
          <div className="sheet enter">
            <Topbar />
            <div className="message">
              <div className="compass">·?·</div>
              <h1>Couldn’t get a fix.</h1>
              <p>{state.error || 'Something went wrong while locating you.'}</p>
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={refresh}>
                Try again
              </button>
            </div>
          </div>
        </main>
        <Toast msg={toast} />
      </>
    );
  }

  /* ---- live / offline ------------------------------------- */
  const offline = phase === 'offline';
  const low = fix.accuracy > LOW_ACCURACY_M;
  const c = coordText(fix, fmt);
  const place = fix.place;
  const staleCls = offline ? ' stale' : '';

  const title = place?.title || (low ? 'Approximate location' : 'Pinpointed');
  const subtitle =
    place?.subtitle || (low ? `Somewhere within about ${Math.round(fix.accuracy)} metres` : '');
  const heroEyebrow = offline
    ? `NEAREST PLACE · ${clockTime(fix.updatedAt)}`
    : low
      ? 'NEAR'
      : 'NEAREST PLACE';

  const levels = (place?.levels || []).slice(0, depthForAccuracy(fix.accuracy));
  const [latHead, latSoft] = splitUncertain(c.lat, fix.accuracy);
  const [lonHead, lonSoft] = splitUncertain(c.lon, fix.accuracy);

  return (
    <>
      <main className="card">
        {offline && (
          <div className="offline-banner">
            <span className="tag">OFFLINE</span>
            <span>last fix {relTime(fix.updatedAt)}</span>
          </div>
        )}
        {!offline && (
          <div className="pull-hint" ref={hintRef}>
            PULL TO REFRESH
          </div>
        )}
        <div
          className="sheet enter"
          ref={sheetRef}
          onPointerDown={offline ? undefined : onPointerDown}
          onPointerMove={offline ? undefined : onPointerMove}
          onPointerUp={offline ? undefined : onPointerEnd}
          onPointerCancel={offline ? undefined : onPointerEnd}
          onPointerLeave={offline ? undefined : onPointerEnd}
        >
          <Topbar />

          {/* hero — nearest place */}
          <div
            className={`hero${offline ? '' : ' tap'}${staleCls}`}
            onClick={offline ? undefined : copyPlace}
            title={offline ? undefined : 'Tap to copy'}
          >
            <div className="eyebrow">{heroEyebrow}</div>
            <div className="place">{title}</div>
            {subtitle && <div className="addr">{subtitle}</div>}
          </div>

          {low && !offline && (
            <div className="note" style={{ marginTop: 22 }}>
              Weak signal — accurate to about {Math.round(fix.accuracy)} m. Moving away from buildings
              and cover usually helps.
            </div>
          )}

          <div className="ruler" />

          {/* hierarchy ladder */}
          {levels.length > 0 ? (
            <>
              <div className={`ladder${staleCls}`}>
                {levels.map((lv, i) => {
                  const glyph = i === 0 ? '┌' : i === levels.length - 1 ? '└' : '├';
                  const leaf = i === levels.length - 1;
                  return (
                    <div
                      key={i}
                      className={`level${leaf ? ' leaf' : ''}${offline ? '' : ' tap'}`}
                      onClick={offline ? undefined : () => copyLevel(i)}
                      title={offline ? undefined : 'Tap to copy'}
                    >
                      <div className="glyph">{glyph}</div>
                      <div className="lbl">{lv.label}</div>
                      <div className="val">{lv.name}</div>
                    </div>
                  );
                })}
              </div>
              {low && place?.levels && place.levels.length > levels.length && (
                <div className="ladder-note">Finer levels need a better fix</div>
              )}
            </>
          ) : (
            place === null && (
              <div className="ladder-note" style={{ paddingLeft: 0 }}>
                Place names unavailable {offline ? '(offline)' : ''}
              </div>
            )
          )}

          <div className="rule" />

          {/* coordinates + copy */}
          <div className="readout">
            <div
              className={offline ? 'coords' : 'tap coords'}
              style={{ padding: '2px 4px' }}
              onClick={offline ? undefined : cycleFmt}
              title={offline ? undefined : 'Tap to switch format'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="eyebrow">POSITION</div>
                <div className="fmt-pill">{fmt === 'dms' ? 'DMS' : 'DD'}</div>
              </div>
              <div className="mono-lg">
                {latHead}
                {latSoft && <span className="soft">{latSoft}</span>}
                <br />
                {lonHead}
                {lonSoft && <span className="soft">{lonSoft}</span>}
              </div>
              {low && fmt === 'dd' && <div className="hint">Greyed digits are uncertain</div>}
            </div>
            {!offline && (
              <button className="btn-ghost" onClick={copyCoords}>
                COPY
              </button>
            )}
          </div>

          {/* altitude */}
          {fix.altitude != null && (
            <div className="alt-row">
              <div
                className={offline ? '' : 'tap'}
                style={{ padding: '2px 4px' }}
                onClick={offline ? undefined : copyAlt}
                title={offline ? undefined : 'Tap to copy'}
              >
                <div className="eyebrow">ALTITUDE</div>
                <div className="mono-lg" style={{ marginTop: 8 }}>
                  {metres(fix.altitude)} m
                </div>
              </div>
              {fix.altSource && <div className="alt-src">{fix.altSource}</div>}
            </div>
          )}

          {/* footer + primary action */}
          <div className="foot">
            <div className="foot-meta">
              <span>±{Math.round(fix.accuracy)} m</span>
              <span>
                {offline ? 'cached ' : 'updated '}
                {relTime(fix.updatedAt)}
              </span>
            </div>
            {offline ? (
              <>
                <div
                  className="fineprint"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--warn-ink)',
                    textAlign: 'center',
                  }}
                >
                  Showing your last known position — will refresh when back online
                </div>
                <button className="btn-secondary" onClick={refresh}>
                  Retry now
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={share}>
                Share my location
              </button>
            )}
          </div>
        </div>
      </main>
      <Toast msg={toast} />
    </>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}
