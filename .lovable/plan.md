## Problem

When the app is already open and the device goes offline, everything keeps working — JS/CSS/HTML are live in memory and writes queue in IndexedDB.

When the device is offline *before* the app is opened (cold start), the browser asks the service worker for the page URL (`/`, `/expenses`, `/add`, etc.). The current Workbox config:

- Uses `NetworkFirst` for navigations with a 3 s timeout.
- Has **no `navigateFallback`** (it was removed earlier because `/index.html` is not served by this SSR app).
- The published HTML is rendered by TanStack Start on Cloudflare and ships with revalidation-friendly cache headers — in practice Workbox's runtime `NetworkFirst` cache for navigations is not reliably populated for these SSR responses, so even URLs the user visited online before don't survive an offline reload.

Net effect: **every** offline cold start fails — both never-visited URLs and previously-visited URLs — because there is no guaranteed cached document to hand to the browser.

Auth and data are unaffected: Supabase reads the session from `localStorage`, and reads/writes use IndexedDB.

## Fix

Ship a small self-contained offline shell that is **precached at service-worker install time** (not dependent on runtime caching of SSR responses), and make Workbox serve it for any navigation that can't be fulfilled from the network.

### 1. `public/offline.html` (new, static)

A minimal self-contained HTML document:

- Same `<link rel="manifest">`, theme-color, and icon links as the app head.
- Inline CSS matching the dark theme (`#1a1c1d` background, light text, Hisaab "₹" mark).
- Centered message: "You're offline — reconnect to load Hisaab."
- Inline script that listens for `window.addEventListener('online', …)` and calls `location.reload()` so the real app boots the instant connectivity returns.
- No imports, no JS bundle dependencies — guaranteed to render on the very first offline cold start.

### 2. `vite.config.ts` — Workbox config

Inside the `workbox` block:

- Add `navigateFallback: "/offline.html"`.
- Keep the existing `navigateFallbackDenylist` for `/api/` and `/~oauth`.
- Ensure `offline.html` is **precached** (so it lives in the SW from install). Two options, pick one:
  - Extend `globPatterns` to include `html` (covers `public/offline.html`), OR
  - Add `additionalManifestEntries: [{ url: "/offline.html", revision: <build hash> }]`.
- Keep the navigation `NetworkFirst` runtime route. Workbox uses the fallback only after both network and any runtime cache miss.

### 3. Result

| Scenario | Before | After |
| --- | --- | --- |
| Open online, go offline, keep using | Works | Works |
| Cold start offline on a previously-visited URL | **Fails today** | Offline shell appears, auto-reloads on reconnect |
| Cold start offline on a never-visited URL | **Fails today** | Offline shell appears, auto-reloads on reconnect |

The fallback covers every offline cold-start case because it's served whenever the network navigation can't be answered, regardless of the URL or whether the user visited it before.

### 4. After publishing

The user should open the published site **once while online** so the new service worker installs and precaches `offline.html`. After that, any airplane-mode cold start will land on the offline shell.

## Out of scope

- Rendering each route's full UI offline (would require shipping a true SPA fallback or precaching every SSR'd page; a single offline shell is the safer minimum fix given the current SSR setup).
- Auth changes — Supabase session restore already works offline.
