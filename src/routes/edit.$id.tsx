import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpenseForm from "@/components/ExpenseForm";

export const Route = createFileRoute("/edit/$id")({
  component: EditPage,
  head: () => ({ meta: [{ title: "Edit expense — Hisaab" }] }),
});

function EditPage() {
  const { id } = Route.useParams();
  return <AppShell><ExpenseForm expenseId={id} /></AppShell>;
}
