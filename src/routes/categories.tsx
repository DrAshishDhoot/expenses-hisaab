import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import CategoriesManager from "@/components/CategoriesManager";

export const Route = createFileRoute("/categories")({
  component: () => <AppShell><CategoriesManager /></AppShell>,
  head: () => ({
    meta: [
      { title: "Categories — Hisaab" },
      { name: "description", content: "Create and organise expense categories and subcategories to keep your Hisaab spending neatly grouped." },
      { property: "og:title", content: "Categories — Hisaab" },
      { property: "og:description", content: "Create and organise expense categories and subcategories to keep your Hisaab spending neatly grouped." },
      { property: "og:url", content: "/categories" },
    ],
    links: [{ rel: "canonical", href: "/categories" }],
  }),
});
