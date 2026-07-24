# Hano

**One glanceable card that tells you exactly where you are.**

A small, offline-capable location utility, built as a **Next.js** app. It reads
your GPS position, names the place you're standing in, and lays out the full
administrative hierarchy — country down to the finest named area your fix can
support — alongside your raw coordinates and altitude. Tap anything to copy it;
share the whole thing in one tap.

Built from the design [`Where Am I.dc.html`](https://claude.ai/design/p/28d132b9-1055-43e7-9dee-97faee5947ea).

![icon](public/icon.svg)

## What it does

- **Live location** via the browser [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API) (`enableHighAccuracy`).
- **Place & hierarchy** by reverse-geocoding with [OpenStreetMap Nominatim](https://nominatim.org/) — coarse → fine, adapting to each country's admin levels.
- **Altitude** from the device where available, otherwise from the [Open-Meteo elevation model](https://open-meteo.com/en/docs/elevation-api) (labelled *terrain model*).
- **Coordinates** in decimal degrees (DD) or degrees-minutes-seconds (DMS) — tap to switch.
- **Copy on tap** for the place, any hierarchy level, coordinates, and altitude.
- **Share** via the native share sheet, falling back to clipboard.

The third-party lookups run through **Next.js route handlers** (`/api/geocode`,
`/api/elevation`) rather than straight from the browser. That lets the server
send Nominatim the identifying `User-Agent` its [usage policy](https://operations.osmfoundation.org/policies/nominatim/)
asks for, cache responses, and keeps the app free of CORS surprises.

### States it handles

| State | Trigger |
| --- | --- |
| **Acquiring** | waiting for the first fix (also the server-rendered shell) |
| **Live** | good fix (accuracy ≤ 50 m) |
| **Low accuracy** | fix worse than 50 m — uncertain digits greyed, ladder trimmed, warning shown |
| **Permission denied** | user blocked location |
| **Offline / cached** | no network — shows the last known fix from `localStorage` |
| **Error / unsupported** | timeout, transient failure, or no Geolocation support |

**Pull the card down** to re-acquire.

## Privacy

Everything user-facing happens on your device. Coordinates are sent to Nominatim
and Open-Meteo (via this app's own API routes) *only* to resolve names and
elevation for the point you're at — no account, no tracking, nothing stored in a
database. The last fix is cached in your browser's `localStorage` so the app
still works offline.

## Getting started

Requires Node.js 18.18+.

```sh
npm install
npm run dev      # http://localhost:3000
```

Geolocation needs a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts):
`localhost` is fine for development; for phone testing, deploy over HTTPS.

```sh
npm run build    # production build
npm run start    # serve the production build
```

Deploy anywhere that runs a Node server (Vercel, a container, etc.) — the API
routes need a server runtime, so this is not a static export.

## Layout

| Path | Role |
| --- | --- |
| `app/layout.tsx` | root layout, fonts, metadata & viewport |
| `app/page.tsx` | renders the client component |
| `app/globals.css` | design tokens & layout (from the source design) |
| `app/manifest.ts` | PWA manifest (metadata route) |
| `app/api/geocode/route.ts` | reverse-geocode proxy (Nominatim + `User-Agent`) |
| `app/api/elevation/route.ts` | elevation proxy (Open-Meteo) |
| `components/WhereAmI.tsx` | client component: state machine, geolocation, UI, interactions |
| `lib/format.ts` | DD/DMS, accuracy → ladder depth, share text |
| `lib/place.ts` | shape a Nominatim response into the place model |
| `lib/geo.ts` | client wrappers over the API routes |
| `lib/types.ts` | shared types |
| `public/sw.js` | service worker — runtime-caches the app shell for offline use |
| `public/icon*.svg` | PWA / favicon icons |

## License

MIT — see [`LICENSE`](LICENSE).
