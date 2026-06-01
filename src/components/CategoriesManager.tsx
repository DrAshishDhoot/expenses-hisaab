import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  listCategories, listSubcategories, saveCategory, saveSubcategory,
  deleteCategory, deleteSubcategory, subscribe,
} from "@/lib/sync";
import type { LocalCategory, LocalSubcategory } from "@/lib/local-db";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesManager() {
  const { user } = useAuth();
  const [cats, setCats] = useState<LocalCategory[]>([]);
  const [subs, setSubs] = useState<LocalSubcategory[]>([]);
  const [newCat, setNewCat] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newSub, setNewSub] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [c, s] = await Promise.all([listCategories(user.id), listSubcategories(user.id)]);
      setCats(c); setSubs(s);
    };
    void load();
    const u = subscribe(() => void load());
    return () => { u; };
  }, [user]);

  const subsByCat = useMemo(() => {
    const m = new Map<string, LocalSubcategory[]>();
    for (const s of subs) {
      if (!m.has(s.category_id)) m.set(s.category_id, []);
      m.get(s.category_id)!.push(s);
    }
    return m;
  }, [subs]);

  const addCat = async () => {
    const name = newCat.trim();
    if (!user || !name) return;
    await saveCategory(user.id, { name });
    setNewCat("");
    toast.success("Category added");
  };

  const addSub = async (catId: string) => {
    const name = (newSub[catId] ?? "").trim();
    if (!user || !name) return;
    await saveSubcategory(user.id, { category_id: catId, name });
    setNewSub((p) => ({ ...p, [catId]: "" }));
    toast.success("Subcategory added");
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Categories</h1>

      <div className="flex gap-2">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addCat()}
          placeholder="New category…"
          className="flex-1 rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={() => void addCat()} className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {cats.map((c) => {
          const cs = (subsByCat.get(c.id) ?? []);
          const isOpen = !!open[c.id];
          return (
            <li key={c.id} className="rounded-xl border border-border/60 bg-card/60">
              <div className="flex items-center justify-between px-3 py-2.5">
                <button
                  onClick={() => setOpen((p) => ({ ...p, [c.id]: !isOpen }))}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  {c.name}
                  <span className="text-xs text-muted-foreground">({cs.length})</span>
                </button>
                <button
                  onClick={async () => { if (confirm(`Delete "${c.name}"?`)) { await deleteCategory(c.id); toast.success("Deleted"); } }}
                  aria-label={`Delete category ${c.name}`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-border/60 px-3 py-3 space-y-2">
                  {cs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <button
                        onClick={async () => { await deleteSubcategory(s.id); toast.success("Removed"); }}
                        aria-label={`Delete subcategory ${s.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <input
                      value={newSub[c.id] ?? ""}
                      onChange={(e) => setNewSub((p) => ({ ...p, [c.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && void addSub(c.id)}
                      placeholder="Add subcategory…"
                      className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    <button onClick={() => void addSub(c.id)} className="rounded-lg bg-secondary px-3 text-sm">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
