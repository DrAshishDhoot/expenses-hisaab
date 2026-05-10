# Hisaab — Expense Manager

A production-grade, offline-first expense tracking web app (installable as a PWA on Android & desktop). Native Android (Kotlin) is out of scope for this build — Lovable targets web. The PWA delivers the same experience: home-screen install, offline use, background sync.

## Scope of this build (Phase 1)

A polished, working web app with:
- Email/password authentication (Lovable Cloud)
- Add / edit / delete expenses with category + subcategory, amount (₹ INR), date, optional notes
- Category & subcategory management (alphabetical)
- Dashboard: month total, recent expenses, per-category breakdown
- Monthly filter + search
- Offline-first: IndexedDB local store, instant save, sync queue, auto-sync on reconnect, sync-status indicator
- Excel (.xlsx) export — monthly and category-wise
- PWA: installable, offline shell

## Design

- Dark grey background (near-black `#0E0F10`), elevated card surface, neon green accent (`#00FF85`)
- Distinctive type pairing: Space Grotesk (display) + Inter (body)
- Minimal, calm, low-clutter; thumb-friendly bottom action bar on mobile; FAB for add
- All colors via semantic tokens in `src/styles.css` (oklch)

## Screens / routes

```
/login              email + password
/signup
/                   dashboard (month total, recent, breakdown)
/add                add expense (modal/sheet on mobile)
/expenses           list + filters + search
/categories         manage categories & subcategories
/settings           export, sign out, sync status
```

## Data model (Lovable Cloud / Postgres)

- `profiles(user_id, display_name, created_at)`
- `categories(id, user_id, name, created_at, updated_at, deleted_at)`
- `subcategories(id, user_id, category_id, name, created_at, updated_at, deleted_at)`
- `expenses(id, user_id, amount_paise bigint, category_id, subcategory_id, description, spent_on date, created_at, updated_at, deleted_at, device_id, client_updated_at)`

RLS: every table restricted to `auth.uid() = user_id`. Soft-delete via `deleted_at`. Amounts stored as integer paise to avoid float drift.

## Offline-first sync engine

- Local store: IndexedDB (via `idb`) mirrors server tables + `outbox` queue of mutations
- Every mutation: write locally → enqueue → UI updates instantly → background worker pushes to Cloud
- Pull: on app start + on reconnect + every N minutes; uses `updated_at > last_pulled_at` per table
- Conflict rule: last-write-wins by `client_updated_at`; deletes are soft (tombstones) and only purged after server confirms
- Per-row `sync_status` derived (synced / pending / error); shown as small dot on each expense and in the header
- `online`/`offline` detected via `navigator.onLine` + ping; queue auto-flushes on reconnect

## Excel export

- `xlsx` library; generates a workbook with one sheet per month or per category, totals row, formatted INR
- Triggered from Settings → "Export"; downloads `hisaab-YYYY-MM.xlsx`

## Tech

- TanStack Start + React 19 + Vite (current template)
- Tailwind v4 + shadcn/ui
- Lovable Cloud (Postgres + Auth) — no external accounts
- `idb` for IndexedDB, `xlsx` for export, `dayjs` for dates
- PWA via vite-plugin-pwa (manifest + service worker for offline shell)

## What's deferred (call out before building)

- Native Android (Kotlin/Compose) app — not buildable in Lovable. The PWA is installable on Android and covers the requirement; a separate Android project would be needed for Play Store.
- Google sign-in — can be added once email/password works.
- Background Sync API beyond what the SW provides — covered by reconnect-triggered flush.

## Build order

1. Enable Lovable Cloud + auth pages
2. Schema + RLS
3. IndexedDB store + outbox + sync engine
4. Categories CRUD
5. Expenses CRUD + dashboard
6. Filters, search, monthly view
7. Excel export
8. PWA manifest + SW
9. Polish (theme, animations, empty states)
