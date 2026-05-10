import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import SettingsPage from "@/components/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: () => <AppShell><SettingsPage /></AppShell>,
  head: () => ({ meta: [{ title: "Settings — Hisaab" }] }),
});
