// Local-first store with Supabase as the cloud backend.
// Mutations write to IndexedDB immediately and enqueue an outbox item;
// the sync engine drains the outbox to Supabase and pulls remote changes.
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  getMeta,
  setMeta,
  type LocalCategory,
  type LocalSubcategory,
  type LocalExpense,
  type OutboxItem,
} from "./local-db";
import { getDeviceId } from "./device";

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => l());
}

type SyncState = "idle" | "syncing" | "error" | "offline";
let _state: SyncState = "idle";
export function syncState() {
  return _state;
}
function setState(s: SyncState) {
  _state = s;
  notify();
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return (await d.count("outbox")) as number;
}

let activeUser: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function enqueue(item: Omit<OutboxItem, "id" | "created_at" | "attempts">) {
  const d = await db();
  await d.put("outbox", {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    attempts: 0,
    ...item,
  });
  notify();
  schedulePush();
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void drainOutbox(), 800);
}

async function drainOutbox() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  const d = await db();
  const items = (await d.getAll("outbox")) as OutboxItem[];
  if (items.length === 0) {
    setState("idle");
    return;
  }
  setState("syncing");
  for (const it of items) {
    try {
      if (it.op === "upsert") {
        const { error } = await supabase.from(it.table).upsert(it.payload as never);
        if (error) throw error;
      } else if (it.op === "delete") {
        const payload = it.payload as { id: string; deleted_at: string; updated_at: string };
        const { error } = await supabase
          .from(it.table)
          .update({ deleted_at: payload.deleted_at, updated_at: payload.updated_at })
          .eq("id", payload.id);
        if (error) throw error;
      }
      await d.delete("outbox", it.id);
    } catch (e) {
      console.error("[sync] outbox item failed", it, e);
      it.attempts += 1;
      it.last_error = e instanceof Error ? e.message : String(e);
      await d.put("outbox", it);
      setState("error");
      notify();
      return;
    }
  }
  notify();
  setState("idle");
}

async function pullRemote(userId: string) {
  const cursor = (await getMeta("sync.cursor")) ?? "1970-01-01T00:00:00.000Z";
  const tables: Array<"categories" | "subcategories" | "expenses"> = [
    "categories",
    "subcategories",
    "expenses",
  ];
  let newCursor = cursor;
  const d = await db();
  for (const t of tables) {
    const { data, error } = await supabase
      .from(t)
      .select("*")
      .eq("user_id", userId)
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) continue;
    const tx = d.transaction(t, "readwrite");
    for (const row of data as Array<{ updated_at: string }>) {
      await tx.store.put(row);
      if (row.updated_at > newCursor) newCursor = row.updated_at;
    }
    await tx.done;
  }
  if (newCursor !== cursor) await setMeta("sync.cursor", newCursor);
}

export async function fullSync(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  setState("syncing");
  try {
    await drainOutbox();
    await pullRemote(userId);
    setState("idle");
  } catch (e) {
    console.error("[sync] full sync failed", e);
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
  await enqueue({ table: "categories", op: "upsert", payload: row as unknown as Record<string, unknown> });
  return row;
}

export async function deleteCategory(id: string) {
  const d = await db();
  const row = (await d.get("categories", id)) as LocalCategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("categories", row);
  await enqueue({
    table: "categories",
    op: "delete",
    payload: { id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at },
  });
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
  await enqueue({ table: "subcategories", op: "upsert", payload: row as unknown as Record<string, unknown> });
  return row;
}

export async function deleteSubcategory(id: string) {
  const d = await db();
  const row = (await d.get("subcategories", id)) as LocalSubcategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("subcategories", row);
  await enqueue({
    table: "subcategories",
    op: "delete",
    payload: { id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at },
  });
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
  await enqueue({ table: "expenses", op: "upsert", payload: row as unknown as Record<string, unknown> });
  return row;
}

export async function deleteExpense(id: string) {
  const d = await db();
  const row = (await d.get("expenses", id)) as LocalExpense | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("expenses", row);
  await enqueue({
    table: "expenses",
    op: "delete",
    payload: { id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at },
  });
}

// Delete expenses spent within a date range (inclusive). Soft-delete + sync.
export async function deleteExpensesInRange(userId: string, fromISO: string, toISO: string): Promise<number> {
  const d = await db();
  const all = (await d.getAllFromIndex("expenses", "user_id", userId)) as LocalExpense[];
  const now = new Date().toISOString();
  const toDelete = all.filter((e) => !e.deleted_at && e.spent_on >= fromISO && e.spent_on <= toISO);
  const tx = d.transaction("expenses", "readwrite");
  for (const e of toDelete) {
    e.deleted_at = now;
    e.updated_at = now;
    await tx.store.put(e);
  }
  await tx.done;
  for (const e of toDelete) {
    await enqueue({
      table: "expenses",
      op: "delete",
      payload: { id: e.id, deleted_at: e.deleted_at!, updated_at: e.updated_at },
    });
  }
  return toDelete.length;
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
