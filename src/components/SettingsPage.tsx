import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/auth";
import { listCategories, listExpenses, listSubcategories, fullSync, pendingCount } from "@/lib/sync";
import { exportMonthly } from "@/lib/export";
import { Download, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    void pendingCount().then(setPending);
    const t = setInterval(() => void pendingCount().then(setPending), 1500);
    return () => clearInterval(t);
  }, []);

  const onExport = async () => {
    if (!user) return;
    const [e, c, s] = await Promise.all([
      listExpenses(user.id), listCategories(user.id), listSubcategories(user.id),
    ]);
    if (e.length === 0) {
      toast.error("Nothing to export yet");
      return;
    }
    exportMonthly(e, c, s);
    toast.success("Exported");
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">{user?.email}</p>
      </div>

      <Section title="Data">
        <Btn icon={<Download className="h-4 w-4" />} onClick={() => void onExport()}>
          Export to Excel
        </Btn>
        <Btn
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={async () => { if (user) { await fullSync(user.id); toast.success("Synced"); } }}
        >
          Sync now {pending > 0 ? `(${pending} pending)` : ""}
        </Btn>
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
        Hisaab · offline-first · synced across devices
      </p>
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
