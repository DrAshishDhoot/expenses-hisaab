// Google Drive sync: stores a single hisaab.json snapshot in the user's
// Drive appDataFolder. The token is the Supabase provider_token returned
// after Google OAuth with the drive.appdata scope.
import { supabase } from "@/integrations/supabase/client";
import { db, type LocalCategory, type LocalSubcategory, type LocalExpense } from "./local-db";

const FILE_NAME = "hisaab.json";
const TOKEN_KEY = "hisaab.gdrive.token";
const TOKEN_EXP_KEY = "hisaab.gdrive.token_exp";

export type Snapshot = {
  version: 1;
  updated_at: string;
  categories: LocalCategory[];
  subcategories: LocalSubcategory[];
  expenses: LocalExpense[];
};

export function setDriveToken(token: string | null, expiresInSec = 3500) {
  if (typeof localStorage === "undefined") return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresInSec * 1000));
}

export function getDriveToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  const t = localStorage.getItem(TOKEN_KEY);
  const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0);
  if (!t || Date.now() > exp) return null;
  return t;
}

export function isDriveConnected(): boolean {
  return !!getDriveToken();
}

export async function connectDrive(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "https://www.googleapis.com/auth/drive.appdata",
      redirectTo: window.location.origin + "/settings",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getDriveToken();
  if (!token) throw new Error("Google Drive not connected");
  return fetch(`https://www.googleapis.com/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function findFileId(): Promise<string | null> {
  const r = await api(
    `drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${FILE_NAME}'`)}&fields=files(id,name,modifiedTime)`,
  );
  if (!r.ok) throw new Error(`Drive list failed: ${r.status}`);
  const j = (await r.json()) as { files?: Array<{ id: string }> };
  return j.files?.[0]?.id ?? null;
}

export async function pullSnapshot(): Promise<Snapshot | null> {
  const id = await findFileId();
  if (!id) return null;
  const r = await api(`drive/v3/files/${id}?alt=media`);
  if (!r.ok) return null;
  return (await r.json()) as Snapshot;
}

export async function pushSnapshot(snap: Snapshot): Promise<void> {
  const existing = await findFileId();
  const boundary = "hisaab" + Math.random().toString(36).slice(2);
  const metadata = existing
    ? {}
    : { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(snap) +
    `\r\n--${boundary}--`;
  const url = existing
    ? `upload/drive/v3/files/${existing}?uploadType=multipart`
    : `upload/drive/v3/files?uploadType=multipart`;
  const r = await api(url, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`Drive upload failed: ${r.status} ${await r.text()}`);
}

export async function buildLocalSnapshot(userId: string): Promise<Snapshot> {
  const d = await db();
  const [cats, subs, exps] = await Promise.all([
    d.getAllFromIndex("categories", "user_id", userId),
    d.getAllFromIndex("subcategories", "user_id", userId),
    d.getAllFromIndex("expenses", "user_id", userId),
  ]);
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    categories: cats as LocalCategory[],
    subcategories: subs as LocalSubcategory[],
    expenses: exps as LocalExpense[],
  };
}

export async function mergeSnapshotIntoLocal(snap: Snapshot): Promise<void> {
  const d = await db();
  const apply = async <T extends { id: string; updated_at: string }>(
    store: "categories" | "subcategories" | "expenses",
    rows: T[],
  ) => {
    const tx = d.transaction(store, "readwrite");
    for (const row of rows) {
      const existing = (await tx.store.get(row.id)) as T | undefined;
      if (!existing || row.updated_at > existing.updated_at) {
        await tx.store.put(row);
      }
    }
    await tx.done;
  };
  await apply("categories", snap.categories);
  await apply("subcategories", snap.subcategories);
  await apply("expenses", snap.expenses);
}
