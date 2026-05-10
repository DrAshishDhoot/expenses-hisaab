import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpenseForm from "@/components/ExpenseForm";

export const Route = createFileRoute("/add")({
  component: () => <AppShell><ExpenseForm /></AppShell>,
  head: () => ({ meta: [{ title: "Add expense — Hisaab" }] }),
});
