import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { listCategories, listExpenses, listSubcategories, deleteExpense, subscribe } from "@/lib/sync";
import type { LocalCategory, LocalExpense, LocalSubcategory } from "@/lib/local-db";
import { formatINR } from "@/lib/format";
import { Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function ExpensesList() {
  const { user } = useAuth();
  const [exps, setExps] = useState<LocalExpense[]>([]);
  const [cats, setCats] = useState<LocalCategory[]>([]);
  const [subs, setSubs] = useState<LocalSubcategory[]>([]);
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [e, c, s] = await Promise.all([
        listExpenses(user.id),
        listCategories(user.id),
        listSubcategories(user.id),
      ]);
      setExps(e); setCats(c); setSubs(s);
    };
    void load();
    const u = subscribe(() => void load());
    return () => { u; };
  }, [user]);

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const subMap = new Map(subs.map((s) => [s.id, s.name]));

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return exps.filter((e) => {
      if (month && !e.spent_on.startsWith(month)) return false;
      if (!ql) return true;
      return (
        (e.description ?? "").toLowerCase().includes(ql) ||
        (catMap.get(e.category_id ?? "") ?? "").toLowerCase().includes(ql) ||
        (subMap.get(e.subcategory_id ?? "") ?? "").toLowerCase().includes(ql)
      );
    });
  }, [exps, q, month, catMap, subMap]);

  const total = filtered.reduce((s, e) => s + e.amount_paise, 0);

  const months = useMemo(() => {
    const set = new Set<string>();
    exps.forEach((e) => set.add(e.spent_on.slice(0, 7)));
    set.add(dayjs().format("YYYY-MM"));
    return [...set].sort().reverse();
  }, [exps]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await deleteExpense(id);
    toast.success("Deleted");
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">All expenses</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-xl border border-border bg-input pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {months.map((m) => <option key={m} value={m}>{dayjs(m + "-01").format("MMM YYYY")}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="ml-2 font-display text-base font-semibold tabular-nums">{formatINR(total)}</span>
        <span className="ml-2 text-muted-foreground">· {filtered.length} entries</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No expenses for this filter.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.id} className="group flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {catMap.get(e.category_id ?? "") ?? "Uncategorised"}
                  {e.subcategory_id ? <span className="text-muted-foreground"> · {subMap.get(e.subcategory_id)}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dayjs(e.spent_on).format("DD MMM YYYY")} {e.description ? `· ${e.description}` : ""}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <span className="font-display text-base font-semibold tabular-nums">{formatINR(e.amount_paise)}</span>
                <Link to="/edit/$id" params={{ id: e.id }} aria-label="Edit expense" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button onClick={() => onDelete(e.id)} aria-label="Delete expense" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
