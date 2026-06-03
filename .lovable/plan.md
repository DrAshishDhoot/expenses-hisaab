## Goal

Make Hisaab installable on Android (Add to Home Screen / "Install app") so it opens in a standalone window like a native app.

## Approach

For installability alone, Android only needs a valid **web app manifest** linked from the HTML plus at least one 192×192 and one 512×512 PNG icon. A service worker is **not** required for the install prompt on modern Chrome/Android, and adding one inside Lovable's preview iframe causes serious issues: stale caches, broken hot reload, and intercepted navigation (per Lovable's PWA guidance).

I therefore recommend the **manifest-only** path and will not add the uploaded `pwabuilder-sw.js`. The uploaded service worker also has problems that would break the app if shipped as-is:
- It references a non-existent `ToDo-replace-this-name.html` offline page.
- It uses StaleWhileRevalidate on `/*`, which would serve outdated builds.
- It pulls Workbox from a CDN at runtime.

The uploaded `manifest.json` also needs fixes before it's valid for install:
- Icons must include 192×192 and 512×512 PNGs; the single 1344×768 icon will not satisfy Android's install criteria and is not square.
- `id` should be a URL path like `/`, not `"Dhoot"`.

## What I'll do

1. **Add `public/manifest.webmanifest`** based on your file, corrected:
   - `name`: "Expenses Hisaab", `short_name`: "Hisaab"
   - `start_url`: "/", `scope`: "/", `id`: "/"
   - `display`: "standalone", `orientation`: "any"
   - `theme_color`: "#1a1c1d", `background_color`: "#1a1c1d" (matches dark app shell — white flashes on launch otherwise)
   - `description`: from your file
   - `icons`: generate proper 192×192, 512×512, and 512×512 maskable PNG icons into `public/icons/` (Hisaab mark on the dark theme color) and reference them

2. **Link the manifest and add iOS install metadata** in `src/routes/__root.tsx` head():
   - `<link rel="manifest" href="/manifest.webmanifest">`
   - `<link rel="apple-touch-icon" href="/icons/icon-192.png">`
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
   - `<meta name="apple-mobile-web-app-title" content="Hisaab">`
   - Keep existing `theme-color` meta.

3. **Do NOT add a service worker.** I'll note that offline caching is out of scope here; the app remains installable and runs online.

## What you'll need to do

- Click **Publish / Update** after the change — install prompts only work on the published HTTPS URL (https://expenses-hisaab.lovable.app), not inside the editor preview iframe.
- On Android Chrome, open the published URL → menu → **Install app** / **Add to Home screen**.

## Out of scope

- Offline support / service worker (rejected for preview-stability reasons above; can be added later if you really need offline, with a Lovable-safe registration guard).
- Wrapping as a true APK via Bubblewrap/TWA — that's a separate packaging step done outside Lovable.

Confirm and I'll implement.