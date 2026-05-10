import { supabase } from "@/integrations/supabase/client";
import { db, getMeta, setMeta, type LocalCategory, type LocalSubcategory, type LocalExpense, type OutboxItem } from "./local-db";
import { getDeviceId } from "./device";

type TableName = "categories" | "subcategories" | "expenses";
const TABLES: TableName[] = ["categories", "subcategories", "expenses"];

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => l());
}

let _state: "idle" | "syncing" | "error" | "offline" = "idle";
export function syncState() {
  return _state;
}
function setState(s: typeof _state) {
  _state = s;
  notify();
}

let pushing = false;

export async function enqueue(item: Omit<OutboxItem, "id" | "created_at" | "attempts">) {
  const d = await db();
  const entry: OutboxItem = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    attempts: 0,
    ...item,
  };
  await d.add("outbox", entry);
  notify();
  void pushOutbox();
}

export async function pushOutbox() {
  if (pushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  pushing = true;
  try {
    const d = await db();
    const items = (await d.getAll("outbox")) as OutboxItem[];
    if (items.length === 0) {
      setState("idle");
      return;
    }
    setState("syncing");
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const item of items) {
      try {
        if (item.op === "upsert") {
          const { error } = await supabase.from(item.table).upsert(item.payload as never);
          if (error) throw error;
        } else if (item.op === "delete") {
          const { id } = item.payload as { id: string };
          const { error } = await supabase
            .from(item.table)
            .update({ deleted_at: new Date().toISOString() } as never)
            .eq("id", id);
          if (error) throw error;
        }
        await d.delete("outbox", item.id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        item.attempts += 1;
        item.last_error = msg;
        await d.put("outbox", item);
        setState("error");
        console.error("[sync] push failed", item.table, msg);
        return;
      }
    }
    setState("idle");
  } finally {
    pushing = false;
    notify();
  }
}

export async function pullAll(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  setState("syncing");
  try {
    const d = await db();
    for (const table of TABLES) {
      const lastKey = `last_pulled_${table}`;
      const last = (await getMeta(lastKey)) ?? "1970-01-01T00:00:00Z";
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", last)
        .order("updated_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      if (data && data.length) {
        const tx = d.transaction(table, "readwrite");
        let max = last;
        for (const row of data as Array<{ updated_at: string }>) {
          await tx.store.put(row);
          if (row.updated_at > max) max = row.updated_at;
        }
        await tx.done;
        await setMeta(lastKey, max);
      }
    }
    setState("idle");
  } catch (e: unknown) {
    console.error("[sync] pull failed", e);
    setState("error");
  } finally {
    notify();
  }
}

export async function fullSync(userId: string) {
  await pushOutbox();
  await pullAll(userId);
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
  return all.filter((e) => !e.deleted_at).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
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
  await enqueue({ table: "categories", op: "upsert", payload: row });
  return row;
}

export async function deleteCategory(id: string) {
  const d = await db();
  const row = (await d.get("categories", id)) as LocalCategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("categories", row);
  await enqueue({ table: "categories", op: "delete", payload: { id } });
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
  await enqueue({ table: "subcategories", op: "upsert", payload: row });
  return row;
}

export async function deleteSubcategory(id: string) {
  const d = await db();
  const row = (await d.get("subcategories", id)) as LocalSubcategory | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("subcategories", row);
  await enqueue({ table: "subcategories", op: "delete", payload: { id } });
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
  await enqueue({ table: "expenses", op: "upsert", payload: row });
  return row;
}

export async function deleteExpense(id: string) {
  const d = await db();
  const row = (await d.get("expenses", id)) as LocalExpense | undefined;
  if (!row) return;
  row.deleted_at = new Date().toISOString();
  row.updated_at = row.deleted_at;
  await d.put("expenses", row);
  await enqueue({ table: "expenses", op: "delete", payload: { id } });
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count("outbox");
}

export function startSyncEngine(userId: string) {
  if (typeof window === "undefined") return () => {};
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
