import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import CategoriesManager from "@/components/CategoriesManager";

export const Route = createFileRoute("/categories")({
  component: () => <AppShell><CategoriesManager /></AppShell>,
  head: () => ({ meta: [{ title: "Categories — Hisaab" }] }),
});
