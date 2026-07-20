import { NextResponse } from 'next/server';
import { shapePlace } from '@/lib/place';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

// Nominatim's usage policy asks for an identifying User-Agent — something a
// browser fetch can't set, but a route handler can. Results are cached briefly.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat') ?? NaN);
  const lon = Number(searchParams.get('lon') ?? NaN);
  const lang = searchParams.get('lang') || 'en';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const url =
    `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1` +
    `&accept-language=${encodeURIComponent(lang)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'geoid/1.0 (Where Am I — https://github.com/)',
        Accept: 'application/json',
      },
      next: { revalidate: 86400 }, // addresses are stable; cache a day
    });
    if (!res.ok) {
      return NextResponse.json({ error: `nominatim ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(shapePlace(data), {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'reverse geocode failed' }, { status: 502 });
  }
}
