import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import SettingsPage from "@/components/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: () => <AppShell><SettingsPage /></AppShell>,
  head: () => ({
    meta: [
      { title: "Settings — Hisaab" },
      { name: "description", content: "Manage your Hisaab account, export your expense history to Excel and review your sync status." },
      { property: "og:title", content: "Settings — Hisaab" },
      { property: "og:description", content: "Manage your Hisaab account, export your expense history to Excel and review your sync status." },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
});
