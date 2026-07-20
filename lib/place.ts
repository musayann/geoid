import type { Level, Place } from './types';

/* ============================================================
   Shaping an OpenStreetMap Nominatim reverse-geocode response
   into the app's place model:

     { title, subtitle, levels: [{ label, name }] }

   where `levels` runs coarse → fine, mirroring the design's
   hierarchy ladder and adapting to each country's admin scheme.
   ============================================================ */

type Address = Record<string, string | undefined>;

interface NominatimResponse {
  name?: string;
  address?: Address;
}

// Coarse → fine. Each rung picks the first OSM key that is present.
const LADDER: { label: string; keys: string[] }[] = [
  { label: 'COUNTRY', keys: ['country'] },
  { label: 'REGION', keys: ['region', 'state', 'province'] },
  { label: 'DISTRICT', keys: ['state_district', 'county'] },
  { label: 'CITY', keys: ['city', 'town', 'municipality', 'village'] },
  { label: 'DISTRICT', keys: ['city_district', 'borough', 'district'] },
  { label: 'AREA', keys: ['suburb', 'neighbourhood', 'quarter', 'hamlet'] },
  { label: 'STREET', keys: ['road', 'pedestrian', 'footway'] },
];

function buildLevels(address: Address): Level[] {
  const levels: Level[] = [];
  const seen = new Set<string>();
  for (const rung of LADDER) {
    const key = rung.keys.find((k) => address[k]);
    if (!key) continue;
    const name = address[key]!;
    if (seen.has(name)) continue; // skip rungs that repeat a coarser value
    seen.add(name);
    levels.push({ label: rung.label, name });
  }
  return levels;
}

// Prefer a genuinely named feature for the hero; else the street, else area.
function buildTitle(data: NominatimResponse, address: Address): string {
  if (data.name) return data.name;
  if (address.road) {
    return address.house_number ? `${address.road} ${address.house_number}` : address.road;
  }
  return (
    address.suburb || address.neighbourhood || address.village ||
    address.town || address.city || address.county || 'Unnamed location'
  );
}

function buildSubtitle(address: Address, title: string): string {
  const parts: string[] = [];
  if (address.road && address.road !== title) parts.push(address.road);
  const area = address.suburb || address.neighbourhood || address.quarter;
  if (area && area !== title) parts.push(area);
  const city = address.city || address.town || address.village || address.municipality;
  if (city && city !== title && !parts.includes(city)) parts.push(city);
  return parts.slice(0, 3).join(', ');
}

export function shapePlace(data: NominatimResponse): Place {
  const address = data.address || {};
  const title = buildTitle(data, address);
  return {
    title,
    subtitle: buildSubtitle(address, title),
    levels: buildLevels(address),
  };
}
