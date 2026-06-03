
## Good news: data offline already works

Your app is already local-first. Every add/edit/delete writes to IndexedDB immediately and queues an "outbox" item. When the phone comes back online, a sync engine drains the queue to the cloud and pulls remote changes — exactly the Keep model.

Files doing this today:
- `src/lib/local-db.ts` — IndexedDB stores for categories, subcategories, expenses, outbox.
- `src/lib/sync.ts` — outbox drain, pull-with-cursor, `online`/`offline` listeners, 60s background sync, manual "tap to sync" button in the header.

So the **data layer** needs no change. What's missing is the **app shell**: if the phone has no network, opening the installed app today still tries to fetch `index.html` + JS from the server and fails. We need to cache the shell so it boots offline.

## What I'll add

Use `vite-plugin-pwa` (the Lovable-approved path) to generate a service worker that caches the built app shell and serves it offline. The worker is **disabled in the Lovable editor preview** and only activates on the published site, so it won't break hot reload.

### 1. Install + configure plugin
- `bun add -D vite-plugin-pwa`
- Update `vite.config.ts` to register VitePWA with:
  - `registerType: "autoUpdate"`
  - `injectRegister: null` (we register from our own guarded wrapper)
  - `devOptions: { enabled: false }`
  - `workbox`:
    - `navigateFallback: "/index.html"` with `NetworkFirst` for HTML navigations
    - `CacheFirst` for same-origin hashed JS/CSS/font/image assets
    - exclude `/~oauth` and `/api/` from navigation fallback

### 2. Guarded registration wrapper
- New file `src/lib/register-sw.ts` that refuses to register when any of these are true:
  - not `import.meta.env.PROD`
  - inside an iframe
  - hostname starts with `id-preview--` or `preview--`
  - hostname ends with `.lovableproject.com`, `.lovableproject-dev.com`, or `.beta.lovable.dev`
  - URL has `?sw=off` (kill switch)
- In any refused context, it unregisters any existing `/sw.js` so a stale worker can't keep the editor preview broken.
- Called once from `src/start.ts`.

### 3. Tiny UX polish (optional, ~10 lines)
- When the SW emits `controllerchange` / "new content available", show a small toast: "Update available — refresh to apply." Uses existing `sonner` toaster, no new deps.

## What I'm NOT changing
- `local-db.ts`, `sync.ts`, outbox logic, conflict handling, UI — all kept as-is.
- Manifest, icons, root head tags — already done in the previous step.
- No hand-written `public/sw.js`. No Workbox CDN at runtime. No cache-busting reload loops.

## How it'll behave after publish

1. User installs the PWA from `expenses-hisaab.lovable.app` (Chrome → menu → Install app).
2. First launch online: SW installs and caches the app shell.
3. Phone goes offline → user opens the app → shell loads from cache → IndexedDB serves data → adds/edits go into the outbox.
4. Phone comes back online → `online` event fires → outbox drains → remote pull merges other devices' changes. Sync badge in the header reflects state (Syncing / Synced / Offline / N pending).

## Caveats I'll tell the user
- Offline only works on the **published HTTPS URL**, not in the editor preview iframe (by design — the guard prevents the SW from registering there).
- iOS requires "Add to Home Screen" from Safari; install prompts behave differently than Android.
- Background sync (syncing while the app is closed) is not part of this — the queue drains as soon as the user opens the app online again, which matches Keep's actual behavior on most phones.

If that all sounds right, approve and I'll implement it.
