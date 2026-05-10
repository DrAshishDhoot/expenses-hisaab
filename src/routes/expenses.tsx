import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpensesList from "@/components/ExpensesList";

export const Route = createFileRoute("/expenses")({
  component: () => <AppShell><ExpensesList /></AppShell>,
  head: () => ({ meta: [{ title: "All expenses — Hisaab" }] }),
});
