import { openDB, type IDBPDatabase } from "idb";

export type LocalCategory = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalSubcategory = {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalExpense = {
  id: string;
  user_id: string;
  amount_paise: number;
  category_id: string | null;
  subcategory_id: string | null;
  description: string | null;
  spent_on: string; // YYYY-MM-DD
  device_id: string | null;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OutboxItem = {
  id: string; // ulid-ish
  table: "categories" | "subcategories" | "expenses";
  op: "upsert" | "delete";
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error?: string;
};

export type MetaItem = { key: string; value: string };

const DB_NAME = "hisaab";
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase> | null = null;

export function db(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("categories")) {
          const s = d.createObjectStore("categories", { keyPath: "id" });
          s.createIndex("user_id", "user_id");
        }
        if (!d.objectStoreNames.contains("subcategories")) {
          const s = d.createObjectStore("subcategories", { keyPath: "id" });
          s.createIndex("user_id", "user_id");
          s.createIndex("category_id", "category_id");
        }
        if (!d.objectStoreNames.contains("expenses")) {
          const s = d.createObjectStore("expenses", { keyPath: "id" });
          s.createIndex("user_id", "user_id");
          s.createIndex("spent_on", "spent_on");
        }
        if (!d.objectStoreNames.contains("outbox")) {
          d.createObjectStore("outbox", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return _db;
}

export async function getMeta(key: string): Promise<string | null> {
  const d = await db();
  const item = (await d.get("meta", key)) as MetaItem | undefined;
  return item?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const d = await db();
  await d.put("meta", { key, value });
}

export async function clearAllLocal(): Promise<void> {
  const d = await db();
  await Promise.all([
    d.clear("categories"),
    d.clear("subcategories"),
    d.clear("expenses"),
    d.clear("outbox"),
    d.clear("meta"),
  ]);
}
