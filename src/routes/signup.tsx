import { useState } from "react";
import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell, Input, GoogleButton } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Sign up — Hisaab" },
      { name: "description", content: "Create a free Hisaab account and start tracking your daily expenses in seconds with offline support and multi-device sync." },
      { property: "og:title", content: "Sign up — Hisaab" },
      { property: "og:description", content: "Create a free Hisaab account and start tracking your daily expenses in seconds with offline support and multi-device sync." },
      { property: "og:url", content: "/signup" },
    ],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
});

function SignupPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Use at least 6 characters"); return; }
    if (password !== password2) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created");
    nav({ to: "/" });
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Start tracking expenses in seconds.</p>

      <GoogleButton label="Sign up with Google" />

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Input label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Input label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <Input label="Confirm password" type="password" value={password2} onChange={setPassword2} autoComplete="new-password" required />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50">
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have one? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
