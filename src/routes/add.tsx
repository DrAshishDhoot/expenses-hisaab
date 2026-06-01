import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpenseForm from "@/components/ExpenseForm";

export const Route = createFileRoute("/add")({
  component: () => <AppShell><ExpenseForm /></AppShell>,
  head: () => ({
    meta: [
      { title: "Add expense — Hisaab" },
      { name: "description", content: "Quickly record a new expense in Hisaab — pick a category, enter the amount and save to your synced ledger." },
      { property: "og:title", content: "Add expense — Hisaab" },
      { property: "og:description", content: "Quickly record a new expense in Hisaab — pick a category, enter the amount and save to your synced ledger." },
      { property: "og:url", content: "/add" },
    ],
    links: [{ rel: "canonical", href: "/add" }],
  }),
});
