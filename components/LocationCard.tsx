'use client';

import { useCallback } from 'react';
import type { CoordFormat, Fix, Phase } from '@/lib/types';
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
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import Topbar from './Topbar';

interface Props {
  phase: Phase;
  fix: Fix;
  fmt: CoordFormat;
  cached: boolean;
  onCycleFmt: () => void;
  onRefresh: () => void;
  copy: (text: string, label: string) => void;
}

/* ============================================================
   LocationCard — the live / offline "here's where you are" view.

   Hero place, admin ladder, coordinates (tap to switch DD/DMS),
   altitude and share/copy actions. Offline drops the interactive
   affordances (pull-to-refresh, tap-to-copy, share) and shows a
   cached banner + retry instead.
   ============================================================ */
export default function LocationCard({
  phase,
  fix,
  fmt,
  cached,
  onCycleFmt,
  onRefresh,
  copy,
}: Props) {
  const offline = phase === 'offline';
  const { sheetRef, hintRef, handlers } = usePullToRefresh(onRefresh, !offline);

  /* ---- actions -------------------------------------------- */
  const share = useCallback(async () => {
    const text = shareText(fix, fmt);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Where Am I', text });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    copy(text, 'summary');
  }, [fix, fmt, copy]);

  const copyPlace = () => {
    const c = coordText(fix, fmt);
    const parts = [fix.place?.title, fix.place?.subtitle].filter(Boolean);
    copy(parts.join(', ') || `${c.lat}, ${c.lon}`, 'place');
  };
  const copyCoords = () => {
    const c = coordText(fix, fmt);
    copy(`${c.lat}, ${c.lon}`, 'coordinates');
  };
  const copyAlt = () => {
    if (fix.altitude != null) copy(`${metres(fix.altitude)} m`, 'altitude');
  };
  const copyLevel = (idx: number) => {
    const lv = fix.place?.levels?.[idx];
    if (lv) copy(lv.name, lv.label.toLowerCase());
  };

  /* ---- derived render values ------------------------------ */
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
      <div className="sheet enter" ref={sheetRef} {...handlers}>
        <Topbar phase={phase} fix={fix} cached={cached} />

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
            onClick={offline ? undefined : onCycleFmt}
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
              <button className="btn-secondary" onClick={onRefresh}>
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
  );
}
