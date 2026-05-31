import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/auth";
import {
  listCategories,
  listExpenses,
  listSubcategories,
  fullSync,
  pendingCount,
  deleteExpensesInRange,
} from "@/lib/sync";
import { exportMonthly } from "@/lib/export";
import { supabase } from "@/integrations/supabase/client";
import { Download, KeyRound, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [pending, setPending] = useState(0);

  // change password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // delete by range
  const [from, setFrom] = useState(dayjs().subtract(1, "year").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().subtract(6, "month").format("YYYY-MM-DD"));
  const [count, setCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    void pendingCount().then(setPending);
    const t = setInterval(() => {
      void pendingCount().then(setPending);
    }, 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const all = await listExpenses(user.id);
      const n = all.filter((e) => e.spent_on >= from && e.spent_on <= to).length;
      setCount(n);
    })();
  }, [user, from, to]);

  const onExport = async () => {
    if (!user) return;
    const [e, c, s] = await Promise.all([
      listExpenses(user.id), listCategories(user.id), listSubcategories(user.id),
    ]);
    if (e.length === 0) { toast.error("Nothing to export yet"); return; }
    exportMonthly(e, c, s);
    toast.success("Exported");
  };

  const onChangePassword = async () => {
    if (pw.length < 6) { toast.error("Use at least 6 characters"); return; }
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) { toast.error(error.message); return; }
    setPw(""); setPw2("");
    toast.success("Password updated");
  };


  const onDeleteRange = async () => {
    if (!user) return;
    const n = await deleteExpensesInRange(user.id, from, to);
    setConfirmOpen(false);
    toast.success(`Deleted ${n} expense${n === 1 ? "" : "s"}`);
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">{user?.email}</p>
      </div>


      <Section title="Data">
        <Btn icon={<Download className="h-4 w-4" />} onClick={() => void onExport()}>Export to Excel</Btn>
        <Btn
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={async () => { if (user) { await fullSync(user.id); toast.success("Synced"); } }}
        >
          Sync now {pending > 0 ? `(${pending} pending)` : ""}
        </Btn>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Trash2 className="h-4 w-4 text-destructive" /> Delete old expenses
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-input px-2 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-input px-2 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <button
            disabled={count === 0 || from > to}
            onClick={() => setConfirmOpen(true)}
            className="w-full rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-40"
          >
            Delete {count} expense{count === 1 ? "" : "s"} in this range
          </button>
        </div>
      </Section>

      <Section title="Change password">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
          <PwInput label="New password" value={pw} onChange={setPw} />
          <PwInput label="Confirm new password" value={pw2} onChange={setPw2} />
          <button
            disabled={pwBusy}
            onClick={() => void onChangePassword()}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow shadow-primary/30 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <KeyRound className="h-4 w-4" /> {pwBusy ? "Updating…" : "Update password"}
          </button>
        </div>
      </Section>

      <Section title="Account">
        <Btn
          icon={<LogOut className="h-4 w-4" />}
          danger
          onClick={async () => { await signOut(); nav({ to: "/login" }); }}
        >
          Sign out
        </Btn>
      </Section>

      <p className="pt-4 text-center text-xs text-muted-foreground">
        Hisaab · offline-first · synced to your account
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} expense{count === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all expenses spent between {from} and {to}. The change syncs to your account. You can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDeleteRange()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Btn({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left text-sm font-medium hover:bg-accent ${danger ? "text-destructive hover:bg-destructive/10" : ""}`}
    >
      <span className={danger ? "text-destructive" : "text-primary"}>{icon}</span>
      {children}
    </button>
  );
}

function PwInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
