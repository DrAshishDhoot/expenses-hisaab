import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Hisaab — Personal expense tracker" },
      { name: "description", content: "Track daily spending, organise expenses by category, and sync across devices with Hisaab — a fast, offline-first personal expense tracker." },
      { property: "og:title", content: "Hisaab — Personal expense tracker" },
      { property: "og:description", content: "Track daily spending, organise expenses by category, and sync across devices with Hisaab — a fast, offline-first personal expense tracker." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-svh place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" />;
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
