import type { CoordFormat, Fix } from './types';

export const LOW_ACCURACY_M = 50; // above this we downgrade to the "rough fix" view

/* ---- coordinate formatting -------------------------------- */
export function fmtDD(lat: number, lon: number) {
  return {
    lat: `${lat < 0 ? '−' : ''}${Math.abs(lat).toFixed(5)}°`,
    lon: `${lon < 0 ? '−' : ''}${Math.abs(lon).toFixed(5)}°`,
  };
}

function toDMS(v: number, pos: string, neg: string) {
  const hemi = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mFull = (a - d) * 60;
  const m = Math.floor(mFull);
  const s = ((mFull - m) * 60).toFixed(1);
  return `${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(4, '0')}″ ${hemi}`;
}

export function fmtDMS(lat: number, lon: number) {
  return { lat: toDMS(lat, 'N', 'S'), lon: toDMS(lon, 'E', 'W') };
}

export function coordText(fix: Fix, fmt: CoordFormat) {
  return fmt === 'dms' ? fmtDMS(fix.lat, fix.lon) : fmtDD(fix.lat, fix.lon);
}

// Split a DD string into a certain head and an uncertain tail (rough fixes).
export function splitUncertain(text: string, accuracy: number): [string, string] {
  if (accuracy <= LOW_ACCURACY_M) return [text, ''];
  const m = text.match(/^(.*\.\d{3})(\d+°)$/);
  if (!m) return [text, ''];
  return [m[1], m[2]];
}

/* ---- misc ------------------------------------------------- */
export function metres(v: number) {
  return Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');
}

export function relTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

export function clockTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// How deep the admin ladder can reasonably go for a given accuracy. Weak fixes
// are truncated so we don't claim a precise level we can't support; a good fix
// shows every level the geocoder returned.
export function depthForAccuracy(accuracy: number) {
  if (accuracy > 2000) return 2;
  if (accuracy > 500) return 3;
  if (accuracy > 150) return 4;
  if (accuracy > LOW_ACCURACY_M) return 5;
  return Infinity;
}

export function shareText(fix: Fix, fmt: CoordFormat) {
  const c = coordText(fix, fmt);
  const lines = ['Where Am I'];
  if (fix.place?.title) lines.push(fix.place.title);
  if (fix.place?.subtitle) lines.push(fix.place.subtitle);
  if (fix.place?.levels?.length) lines.push(fix.place.levels.map((l) => l.name).join(' › '));
  lines.push(`${c.lat}, ${c.lon}`);
  if (fix.altitude != null) {
    lines.push(`alt ${metres(fix.altitude)} m${fix.altSource ? ` (${fix.altSource})` : ''}`);
  }
  lines.push(`±${Math.round(fix.accuracy)} m accuracy · updated ${relTime(fix.updatedAt)}`);
  lines.push(`https://maps.google.com/?q=${fix.lat},${fix.lon}`);
  return lines.join('\n');
}
