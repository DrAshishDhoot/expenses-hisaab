import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import ExpenseForm from "@/components/ExpenseForm";

export const Route = createFileRoute("/edit/$id")({
  component: EditPage,
  head: ({ params }) => ({
    meta: [
      { title: "Edit expense — Hisaab" },
      { name: "description", content: "Update the details of a previously recorded expense in your Hisaab ledger." },
      { property: "og:title", content: "Edit expense — Hisaab" },
      { property: "og:description", content: "Update the details of a previously recorded expense in your Hisaab ledger." },
      { property: "og:url", content: `/edit/${params.id}` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EditPage() {
  const { id } = Route.useParams();
  return <AppShell><ExpenseForm expenseId={id} /></AppShell>;
}
