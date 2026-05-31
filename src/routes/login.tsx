import { useState } from "react";
import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Hisaab" }] }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/" });
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your Hisaab account.</p>

      <GoogleButton label="Sign in with Google" />

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Input label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Input label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-card/70 p-7 shadow-2xl shadow-primary/5 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display font-bold">₹</span>
          <span className="font-display text-xl font-semibold">Hisaab</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Input({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

export function GoogleButton({ label }: { label: string }) {
  const onClick = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(result.error.message ?? "Could not sign in with Google");
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold hover:bg-accent"
    >
      <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 8 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.1 0 9.7-1.9 13.2-5.1l-6.1-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.4-11.3-8l-6.6 5.1C9.5 39.5 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.2 5.7l6.1 5.2C40.8 35.6 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/>
      </svg>
      {label}
    </button>
  );
}
