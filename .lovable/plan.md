# Plan

## 1. Revert backend from Google Drive to Supabase

Restore the previous local-first + Supabase sync model. Google sign-in stays as a login option, but data lives in Supabase Postgres (tables already exist with RLS).

- **`src/lib/sync.ts`** — rewrite to push/pull per-row against Supabase tables (`categories`, `subcategories`, `expenses`) using the outbox pattern already supported by `local-db.ts`. Mutations enqueue to outbox + write IndexedDB; sync engine drains outbox via `supabase.from(...).upsert()` / soft-delete updates, and pulls server rows newer than last sync cursor.
- **`src/lib/auth.tsx`** — remove `setDriveToken` / `captureProviderToken` logic. Keep `startSyncEngine(userId)` call.
- **`src/lib/drive.ts`** — delete file.
- **`src/components/SettingsPage.tsx`** — remove "Reconnect Google Drive" section and related UI; keep password update, delete-by-date-range, and sign-out.
- **`src/routes/login.tsx` / `signup.tsx`** — keep both email/password and Google OAuth buttons (Google now only authenticates; no Drive scope). Drop the `drive.appdata` scope and `access_type/prompt` params.
- **`src/components/AppShell.tsx`** — remove any "disconnected" Drive banner; keep online/offline + syncing indicators.
- Existing Supabase migrations and RLS policies remain unchanged.

Note: any data currently only in a user's Drive snapshot will not auto-migrate back. New writes go to Supabase from this point forward.

## 2. Background colour → Ash grey

Update `src/styles.css` to shift `--background` (and related dark surfaces) from near-black to Ash `#454545`, with `--card`, `--muted`, `--accent`, `--border`, `--input` re-tuned one step lighter/darker around it so contrast stays readable. Neon green primary stays unchanged.

```text
--background  oklch(0.42 0 0)   ≈ #454545  (Ash)
--card        oklch(0.46 0 0)   slightly lighter panels
--popover     oklch(0.46 0 0)
--secondary   oklch(0.50 0 0)
--muted       oklch(0.48 0 0)
--accent      oklch(0.54 0 0)
--border      oklch(0.56 0 0)
--input       oklch(0.50 0 0)
--foreground  oklch(0.98 0 0)   keep near-white text
```

The ambient neon glow in `body::before` stays but will read softer against the lighter background.

## Files touched

- rewrite: `src/lib/sync.ts`
- edit: `src/lib/auth.tsx`, `src/components/SettingsPage.tsx`, `src/components/AppShell.tsx`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/styles.css`
- delete: `src/lib/drive.ts`
