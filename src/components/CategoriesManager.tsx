import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  listCategories, listSubcategories, saveCategory, saveSubcategory,
  deleteCategory, deleteSubcategory, subscribe,
} from "@/lib/sync";
import type { LocalCategory, LocalSubcategory } from "@/lib/local-db";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";

type EditState = { kind: "cat" | "sub"; id: string; value: string } | null;

export default function CategoriesManager() {
  const { user } = useAuth();
  const [cats, setCats] = useState<LocalCategory[]>([]);
  const [subs, setSubs] = useState<LocalSubcategory[]>([]);
  const [newCat, setNewCat] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditState>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editing) editInputRef.current?.select();
  }, [editing]);

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

  const commitEdit = async () => {
    if (!user || !editing) return;
    const name = editing.value.trim();
    const current = editing;
    setEditing(null);
    if (!name) return;
    if (current.kind === "cat") {
      const existing = cats.find((c) => c.id === current.id);
      if (!existing || existing.name === name) return;
      await saveCategory(user.id, { id: current.id, name });
      toast.success("Category updated");
    } else {
      const existing = subs.find((s) => s.id === current.id);
      if (!existing || existing.name === name) return;
      await saveSubcategory(user.id, { id: current.id, category_id: existing.category_id, name });
      toast.success("Subcategory updated");
    }
  };

  const renderEditInput = (extraClass = "") => (
    <input
      ref={editInputRef}
      value={editing!.value}
      onChange={(e) => setEditing({ ...editing!, value: e.target.value })}
      onBlur={() => void commitEdit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); void commitEdit(); }
        else if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
      }}
      autoFocus
      className={`rounded-md border border-primary bg-input px-2 py-1 text-sm outline-none ${extraClass}`}
    />
  );

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
          const isEditingCat = editing?.kind === "cat" && editing.id === c.id;
          return (
            <li key={c.id} className="rounded-xl border border-border/60 bg-card/60">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [c.id]: !isOpen }))}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    className="text-muted-foreground"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {isEditingCat ? (
                    renderEditInput("flex-1 min-w-0")
                  ) : (
                    <button
                      onClick={() => setEditing({ kind: "cat", id: c.id, value: c.name })}
                      className="flex flex-1 items-center gap-2 text-left text-sm font-medium min-w-0"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">({cs.length})</span>
                      <Pencil className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                    </button>
                  )}
                </div>
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
                  {cs.map((s) => {
                    const isEditingSub = editing?.kind === "sub" && editing.id === s.id;
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                        {isEditingSub ? (
                          renderEditInput("flex-1 min-w-0")
                        ) : (
                          <button
                            onClick={() => setEditing({ kind: "sub", id: s.id, value: s.name })}
                            className="flex flex-1 items-center gap-2 text-left min-w-0"
                          >
                            <span className="truncate">{s.name}</span>
                            <Pencil className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={async () => { await deleteSubcategory(s.id); toast.success("Removed"); }}
                          aria-label={`Delete subcategory ${s.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
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
