## Problem

On Android, after the app has been offline for a few hours, a cold launch shows "Loading…" forever (you read it as "Logging in") and never reaches the app.

## Root cause

`src/lib/auth.tsx` keeps `loading = true` until `supabase.auth.getSession()` resolves. The Supabase client persists the session in `localStorage`, but on startup it also tries to **refresh the access token** if it is expired or near expiry. That refresh is a network call to the auth server. Offline, the call hangs (no `offline` rejection on Android WebView for a long time) or fails, so `getSession()` never resolves → `loading` stays `true` → the shell renders "Loading…" forever.

This is the real reason an "offline-first" app fails to open offline. The IndexedDB data, service worker cache, and swipe nav are all fine — the gate in front of them is the auth bootstrap.

## Fix

Make auth bootstrap non-blocking and offline-tolerant. The cached session in `localStorage` is the source of truth at cold start; network refresh is best-effort in the background.

### 1. `src/lib/auth.tsx` — read cached session synchronously, never block UI on network

- On mount, **synchronously** read the persisted Supabase session from `localStorage` (key `sb-<ref>-auth-token`) and seed `session` + `loading=false` immediately if it exists. The app renders right away with the cached user.
- Then call `supabase.auth.getSession()` in the background to let the SDK refresh if online. Wrap it in a 4 s timeout so an offline hang can never block anything; on timeout or error, keep the cached session.
- Keep the `onAuthStateChange` subscription, but it only updates state — it no longer controls `loading`.
- If there is no cached session at all, set `loading=false` after the timeout too, so we fall through to `/login` instead of hanging.

### 2. `src/components/AppShell.tsx` — don't strand the user on "Loading…"

- Current behavior: `if (loading) return "Loading…"`. With the change above, `loading` flips to `false` immediately when a cached session exists, so this screen disappears on offline cold start.
- No logic change needed beyond what (1) provides; the existing `if (!user) return <Navigate to="/login" />` still handles the genuinely-signed-out case.

### 3. `src/lib/sync.ts` — already offline-safe, no change

`startSyncEngine` and `fullSync` already early-return with `setState("offline")` when `navigator.onLine` is false, so seeding a cached user offline will not throw or block. Outbox writes from `/add` continue to queue in IndexedDB and drain when back online. Confirmed by reading the file — no edits required.

### 4. Login route — minor guard

`src/routes/login.tsx` is not in context yet. I'll read it during build and, if it also gates on `loading`, apply the same "trust cached session" pattern so a signed-in user landing on `/login` offline is redirected to `/` instead of seeing a spinner. No other behavior changes.

## What this does NOT change

- No change to the service worker, Workbox config, or precache strategy from the previous turn.
- No change to swipe navigation, Categories editing, sync engine, IndexedDB schema, or any UI.
- No change to the sign-in/sign-up flow when online — refresh still runs, tokens still rotate.

## Why this is the right fix (not a workaround)

Supabase explicitly persists sessions to `localStorage` so apps can boot without the network. Treating the cached session as authoritative at cold start, and treating the refresh call as best-effort, is the standard offline-first pattern. The current code inverts that by making the network refresh a blocking precondition.

## Verification after build

1. Open the published app online once so the new JS installs.
2. Force-quit, enable airplane mode, relaunch.
3. Expected: app renders the Home tab immediately using cached data; "Sync" badge shows "Offline"; `/add` accepts entries that queue in the outbox; entries appear in lists; on reconnect, badge flips to "Syncing" then "Synced".
