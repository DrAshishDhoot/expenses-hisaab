## Goal

1. **Full offline cold start** — when the device is offline and Hisaab is launched (PWA icon or browser refresh), the real React app boots, the user can log in from the cached session, and add / edit / delete expenses. Queued writes sync when the device comes back online (already working today).
2. **Swipe navigation** — horizontal swipe gestures on the main screen move between the bottom-tab pages in order: Home ↔ All ↔ Add ↔ Tags ↔ More.

---

## Part 1 — Full offline cold start

### Approach: ship an SPA app-shell and let Workbox serve it for all navigations offline

Today the published HTML is server-rendered by TanStack Start on Cloudflare. The service worker can't reliably cache those SSR responses, so a cold offline launch has no document to render.

The fix is to add a single static **app shell** HTML at `/app-shell.html` that:

- Loads the same client JS/CSS bundles the SSR pages load (precached by Workbox via `globPatterns`).
- Boots the TanStack Router on the client only (`ssr: false` for this entry, no server data).
- Renders the same routes (`/`, `/add`, `/expenses`, `/categories`, `/settings`, `/edit/$id`) using IndexedDB data and the cached Supabase session in `localStorage`.

Workbox is then configured so that **any navigation that fails the network** returns this precached app shell. The browser loads it, React hydrates from cache, and the user lands on the right route via `window.location.pathname`.

### Files to change

1. **`public/app-shell.html`** (new)
    - Minimal HTML with `<link rel="manifest">`, theme color, icon links, and the inline `<script type="module">` that imports the client entry (the same bundle used by SSR).
    - Includes a `<div id="root">` and the standard head tags.
    - No server data — the client router takes the current `location.pathname` and renders.

2. **`src/router.tsx`**
    - Add a small helper to detect "shell boot" (when the script runs from `app-shell.html`) and start the router with `history: createBrowserHistory()` on the current URL, skipping any SSR hydration.

3. **`src/routes/__root.tsx`**
    - Ensure the root component does not depend on server-only data. Auth and data already work from `localStorage` / IndexedDB, so no change to providers — only verify no loader on a public route fetches via `requireSupabaseAuth` during cold boot.

4. **`vite.config.ts`** (Workbox)
    - `additionalManifestEntries: [{ url: "/app-shell.html", revision: <build-hash> }]` so the shell is precached at SW install.
    - Replace the current `navigateFallback: "/offline.html"` with `navigateFallback: "/app-shell.html"`.
    - Keep `navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/]`.
    - Keep the `NetworkFirst` navigation route; the precached shell is the fallback when the network fails.
    - Keep `CacheFirst` for `style|script|worker|font` so the JS/CSS bundles the shell needs are precached and instantly available offline.

5. **`public/offline.html`** — delete. No longer needed; the shell replaces it.

### Auth and data offline

- **Auth**: Supabase persists the session in `localStorage`. `supabase.auth.getSession()` returns the session synchronously offline. If the session token is expired and there's no network to refresh it, the local DB is still readable; writes queue and sync on reconnect (current behavior).
- **Routes that call protected `createServerFn`**: skip during cold offline boot. The existing pages already read from IndexedDB via `src/lib/local-db.ts` and only call server fns opportunistically. No code changes required there.

### Result

| Scenario | Before | After |
| --- | --- | --- |
| Open online, go offline, keep using | Works | Works |
| Cold start offline on a previously-visited URL | Fails | Full app boots, can add/edit, syncs later |
| Cold start offline on never-visited URL | Fails | Full app boots, can add/edit, syncs later |

### Caveats

- First time the user opens the app online after this change, the new service worker installs and precaches the shell + bundles. After that, cold offline launches work.
- If the cached JS bundle is from an old build, the next online launch will auto-update (`registerType: "autoUpdate"` is already set).

---

## Part 2 — Swipe navigation between tabs

### Behavior

- Horizontal swipe left → next tab. Horizontal swipe right → previous tab.
- Tab order matches the bottom nav: `/` → `/expenses` → `/add` → `/categories` → `/settings`.
- Wraps at the ends (swiping left on `/settings` stays on `/settings`; no wrap-around — feels less jarring).
- Vertical scroll is unaffected (swipe detection ignores gestures where vertical delta > horizontal delta).
- Threshold: 60px horizontal, < 30° angle, faster than 0.2px/ms. Tuned to avoid accidental triggers while scrolling lists.
- Disabled on the `/edit/$id`, `/login`, `/signup` routes (those are not in the tab order).

### Files to change

1. **`src/hooks/use-swipe-nav.tsx`** (new)
    - Custom hook that attaches `touchstart` / `touchmove` / `touchend` listeners to a ref.
    - Computes delta + velocity, calls `onSwipeLeft` / `onSwipeRight` when thresholds are met.
    - Pointer events fallback for desktop trackpad swipes (optional, low priority).

2. **`src/components/AppShell.tsx`**
    - Import the hook and `useNavigate` from `@tanstack/react-router`.
    - Define `const TAB_ORDER = ["/", "/expenses", "/add", "/categories", "/settings"]`.
    - Attach the swipe handler to the `<main>` element. On swipe, look up the current tab index from `location.pathname` and navigate to neighbor.
    - Add a subtle visual hint on first launch (optional; can skip).

3. No router config changes.

### Accessibility

- Keyboard users are unaffected — bottom nav links remain primary.
- Screen reader announcements use the normal route change from `useNavigate`.

---

## Out of scope

- Replacing TanStack Start SSR with a pure SPA build (the shell coexists with SSR).
- Animated page transitions on swipe (can add later with `framer-motion` if you want the iOS-style slide).
- Swipe-back gesture (browser already supports edge-swipe on iOS/Android).

---

## Order of work

1. Add `public/app-shell.html` + Workbox changes + delete `offline.html`.
2. Verify cold offline launch in the published build (preview can't show the SW behavior reliably).
3. Add `use-swipe-nav` hook and wire into `AppShell`.
4. Test on mobile in the published build.
