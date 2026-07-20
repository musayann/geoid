import type { Place } from './types';

// Thin client wrappers over our own route handlers (which proxy Nominatim and
// Open-Meteo). Keeping the third-party calls server-side avoids CORS surprises
// and lets us identify the app to Nominatim per its usage policy.

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const lang = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
  const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  return res.json();
}

export async function lookupElevation(lat: number, lon: number): Promise<number | null> {
  const res = await fetch(`/api/elevation?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`elevation ${res.status}`);
  const data = await res.json();
  return typeof data.elevation === 'number' ? data.elevation : null;
}
