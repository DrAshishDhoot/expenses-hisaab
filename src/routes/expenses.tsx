import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpensesList from "@/components/ExpensesList";

export const Route = createFileRoute("/expenses")({
  component: () => <AppShell><ExpensesList /></AppShell>,
  head: () => ({
    meta: [
      { title: "All expenses — Hisaab" },
      { name: "description", content: "Browse, search and filter every expense you've recorded in Hisaab, grouped by month with running totals." },
      { property: "og:title", content: "All expenses — Hisaab" },
      { property: "og:description", content: "Browse, search and filter every expense you've recorded in Hisaab, grouped by month with running totals." },
      { property: "og:url", content: "/expenses" },
    ],
    links: [{ rel: "canonical", href: "/expenses" }],
  }),
});
