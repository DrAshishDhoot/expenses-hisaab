// Local-first store with Google Drive as the only cloud backend.
// All mutations write to IndexedDB immediately, then debounce-push a full
// snapshot JSON to the user's Drive appDataFolder.
import { db, type LocalCategory, type LocalSubcategory, type LocalExpense } from "./local-db";
import { getDeviceId } from "./device";
import {
  buildLocalSnapshot,
  isDriveConnected,
  mergeSnapshotIntoLocal,
  pullSnapshot,
  pushSnapshot,
} from "./drive";

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => l());
}

type SyncState = "idle" | "syncing" | "error" | "offline" | "disconnected";
let _state: SyncState = "idle";
export function syncState() {
  return _state;
}
function setState(s: SyncState) {
  _state = s;
  notify();
}

let pendingPush = 0;
export async function pendingCount(): Promise<number> {
  return pendingPush;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let activeUser: string | null = null;

function schedulePush(userId: string) {
  activeUser = userId;
  pendingPush += 1;
  notify();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void doPush(userId), 1500);
}

async function doPush(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  if (!isDriveConnected()) {
    setState("disconnected");
    return;
  }
  setState("syncing");
  try {
    const snap = await buildLocalSnapshot(userId);
    await pushSnapshot(snap);
    pendingPush = 0;
    setState("idle");
  } catch (e) {
    console.error("[drive push] failed", e);
    setState("error");
  } finally {
    notify();
  }
}

export async function fullSync(userId: string) {
  if (!isDriveConnected()) {
    setState("disconnected");
    return;
  }
  setState("syncing");
  try {
    const remote = await pullSnapshot();
    if (remote) await mergeSnapshotIntoLocal(remote);
    const snap = await buildLocalSnapshot(userId);
    await pushSnapshot(snap);
    pendingPush = 0;
    setState("idle");
  } catch (e) {
    console.error("[drive sync] failed", e);
    setState("error");
  } finally {
    notify();
  }
}

// ---------------- CRUD helpers ----------------

export async function listCategories(userId: string): Promise<LocalCategory[]> {
  const d = await db();
  const all = (await d.getAllFromIndex("categories", "user_id", userId)) as LocalCategory[];
  return all.filter((c) => !c.deleted_at).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSubcategories(userId: string): Promise<LocalSubcategory[]> {
  const d = await db();
  const all = (await d.getAllFromIndex("subcategories", "user_id", userId)) as LocalSubcategory[];
  return all.filter((s) => !s.deleted_at).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listExpenses(userId: string): Promise<LocalExpense[]> {
  const d = await db();
  const all = (await d.getAllFromIndex("expenses", "user_id", userId)) as LocalExpense[];
  return all
    .filter((e) => !e.deleted_at)
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
}

export async function saveCategory(userId: string, input: { id?: string; name: string }): Promise<LocalCategory> {
  const d = await db();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? ((await d.get("categories", input.id)) as LocalCategory | undefined) : undefined;
  const row: LocalCategory = {
    id,
    user_id: userId,
    name: input.name.trim(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  };
  await d.put("categories", row);
  schedulePush(userId);
  return row;
}

export async function deleteCategory(id: string) {
  const d = await db();
  const row = (await d.get("categories", id)) as LocalCategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("categories", row);
  schedulePush(row.user_id);
}

export async function saveSubcategory(userId: string, input: { id?: string; category_id: string; name: string }): Promise<LocalSubcategory> {
  const d = await db();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? ((await d.get("subcategories", input.id)) as LocalSubcategory | undefined) : undefined;
  const row: LocalSubcategory = {
    id,
    user_id: userId,
    category_id: input.category_id,
    name: input.name.trim(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  };
  await d.put("subcategories", row);
  schedulePush(userId);
  return row;
}

export async function deleteSubcategory(id: string) {
  const d = await db();
  const row = (await d.get("subcategories", id)) as LocalSubcategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("subcategories", row);
  schedulePush(row.user_id);
}

export async function saveExpense(
  userId: string,
  input: {
    id?: string;
    amount_paise: number;
    category_id: string | null;
    subcategory_id: string | null;
    description: string | null;
    spent_on: string;
  },
): Promise<LocalExpense> {
  const d = await db();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? ((await d.get("expenses", input.id)) as LocalExpense | undefined) : undefined;
  const row: LocalExpense = {
    id,
    user_id: userId,
    amount_paise: input.amount_paise,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id,
    description: input.description,
    spent_on: input.spent_on,
    device_id: getDeviceId(),
    client_updated_at: now,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  };
  await d.put("expenses", row);
  schedulePush(userId);
  return row;
}

export async function deleteExpense(id: string) {
  const d = await db();
  const row = (await d.get("expenses", id)) as LocalExpense | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("expenses", row);
  schedulePush(row.user_id);
}

// Delete expenses spent within a date range (inclusive). Soft-delete + sync.
export async function deleteExpensesInRange(userId: string, fromISO: string, toISO: string): Promise<number> {
  const d = await db();
  const all = (await d.getAllFromIndex("expenses", "user_id", userId)) as LocalExpense[];
  const now = new Date().toISOString();
  let n = 0;
  const tx = d.transaction("expenses", "readwrite");
  for (const e of all) {
    if (e.deleted_at) continue;
    if (e.spent_on >= fromISO && e.spent_on <= toISO) {
      e.deleted_at = now;
      e.updated_at = now;
      await tx.store.put(e);
      n += 1;
    }
  }
  await tx.done;
  if (n > 0) schedulePush(userId);
  return n;
}

export function startSyncEngine(userId: string) {
  if (typeof window === "undefined") return () => {};
  activeUser = userId;
  const onOnline = () => {
    setState("idle");
    void fullSync(userId);
  };
  const onOffline = () => setState("offline");
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  void fullSync(userId);
  const interval = window.setInterval(() => void fullSync(userId), 60_000);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.clearInterval(interval);
  };
}

export function getActiveUser() {
  return activeUser;
}
