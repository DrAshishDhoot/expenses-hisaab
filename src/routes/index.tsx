import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  component: Index,
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
