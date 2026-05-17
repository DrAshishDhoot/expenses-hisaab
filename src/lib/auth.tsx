import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { startSyncEngine } from "./sync";
import { clearAllLocal } from "./local-db";
import { setDriveToken } from "./drive";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });

function captureProviderToken(s: Session | null) {
  // Supabase returns provider_token (Google access_token) right after OAuth.
  // It is short-lived (~1 hour) and not refreshed; user must reconnect when it expires.
  const tok = (s as unknown as { provider_token?: string } | null)?.provider_token;
  if (tok) setDriveToken(tok);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      captureProviderToken(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      captureProviderToken(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
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
  setDriveToken(null);
  await clearAllLocal();
}
