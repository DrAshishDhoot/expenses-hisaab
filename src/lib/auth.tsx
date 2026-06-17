import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { startSyncEngine } from "./sync";
import { clearAllLocal } from "./local-db";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });
const AUTH_BOOT_TIMEOUT_MS = 4_000;

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return typeof candidate.access_token === "string" && !!candidate.user;
}

function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i))
      .filter((key): key is string => !!key && /^sb-.+-auth-token$/.test(key));

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (isSession(parsed)) return parsed;
      if (parsed && typeof parsed === "object" && isSession((parsed as { currentSession?: unknown }).currentSession)) {
        return (parsed as { currentSession: Session }).currentSession;
      }
    }
  } catch (error) {
    console.warn("[auth] Could not read cached session", error);
  }
  return null;
}

async function getSessionWithTimeout(): Promise<Session | null> {
  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), AUTH_BOOT_TIMEOUT_MS);
  });
  const session = supabase.auth.getSession().then(({ data }) => data.session ?? null).catch((error) => {
    console.warn("[auth] Session refresh failed", error);
    return null;
  });
  return Promise.race([session, timeout]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readCachedSession());
  const [loading, setLoading] = useState(() => readCachedSession() === null);

  useEffect(() => {
    const cachedSession = readCachedSession();
    if (cachedSession) {
      setSession(cachedSession);
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) {
        setSession(s);
        return;
      }
      if (event === "SIGNED_OUT") {
        setSession(null);
      }
    });

    let cancelled = false;
    const refreshSession = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cachedSession && !cancelled) setLoading(false);
        return;
      }
      const refreshed = await getSessionWithTimeout();
      if (cancelled) return;
      if (refreshed) setSession(refreshed);
      setLoading(false);
    };

    void refreshSession();
    const onOnline = () => void refreshSession();
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const stop = startSyncEngine(session.user.id);
    return stop;
  }, [session?.user?.id]);

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export async function signOut() {
  await supabase.auth.signOut();
  await clearAllLocal();
}
