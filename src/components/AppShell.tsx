import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, Plus, ListOrdered, Tags, Settings as SettingsIcon, Wifi, WifiOff, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { subscribe, syncState, pendingCount, fullSync } from "@/lib/sync";
import { useAuth } from "@/lib/auth";

function SyncBadge() {
  const [state, setState] = useState(syncState());
  const [pending, setPending] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const refresh = async () => {
      setState(syncState());
      setPending(await pendingCount());
    };
    void refresh();
    return subscribe(refresh);
  }, []);

  const icon = {
    idle: <Check className="h-3.5 w-3.5" />,
    syncing: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
    error: <AlertTriangle className="h-3.5 w-3.5" />,
    offline: <WifiOff className="h-3.5 w-3.5" />,
  }[state];

  const label = state === "idle" ? (pending ? `${pending} pending` : "Synced") : state === "syncing" ? "Syncing" : state === "error" ? "Sync error" : "Offline";

  return (
    <button
      onClick={() => user && void fullSync(user.id)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
      title="Tap to sync now"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

const tabs = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/expenses", label: "All", icon: ListOrdered, exact: false },
  { to: "/add", label: "Add", icon: Plus, exact: false, primary: true },
  { to: "/categories", label: "Tags", icon: Tags, exact: false },
  { to: "/settings", label: "More", icon: SettingsIcon, exact: false },
];

export default function AppShell() {
  const loc = useLocation();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="relative min-h-svh">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground font-display font-bold">₹</span>
            <span className="font-display text-lg font-semibold tracking-tight">Hisaab</span>
          </Link>
          <div className="flex items-center gap-2">
            {online ? null : <Wifi className="h-3.5 w-3.5 text-muted-foreground/40" />}
            <SyncBadge />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          {tabs.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            if (t.primary) {
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              );
            }
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-medium transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
