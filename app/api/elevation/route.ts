import { NextResponse } from 'next/server';

const OPEN_METEO = 'https://api.open-meteo.com/v1/elevation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat') ?? NaN);
  const lon = Number(searchParams.get('lon') ?? NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${OPEN_METEO}?latitude=${lat}&longitude=${lon}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `open-meteo ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const v = Array.isArray(data.elevation) ? data.elevation[0] : data.elevation;
    return NextResponse.json({ elevation: Number.isFinite(v) ? v : null });
  } catch {
    return NextResponse.json({ error: 'elevation lookup failed' }, { status: 502 });
  }
}
