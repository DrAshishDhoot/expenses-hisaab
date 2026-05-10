import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "@/lib/auth";
import { listCategories, listExpenses, listSubcategories } from "@/lib/sync";
import { subscribe } from "@/lib/sync";
import type { LocalCategory, LocalExpense, LocalSubcategory } from "@/lib/local-db";
import { formatINR } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [exps, setExps] = useState<LocalExpense[]>([]);
  const [cats, setCats] = useState<LocalCategory[]>([]);
  const [subs, setSubs] = useState<LocalSubcategory[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [e, c, s] = await Promise.all([
        listExpenses(user.id),
        listCategories(user.id),
        listSubcategories(user.id),
      ]);
      setExps(e);
      setCats(c);
      setSubs(s);
    };
    void load();
    const u = subscribe(() => void load());
    return () => { u; };
  }, [user]);

  const month = dayjs().format("YYYY-MM");
  const monthExps = useMemo(() => exps.filter((e) => e.spent_on.startsWith(month)), [exps, month]);
  const total = monthExps.reduce((s, e) => s + e.amount_paise, 0);
  const todayTotal = exps
    .filter((e) => e.spent_on === dayjs().format("YYYY-MM-DD"))
    .reduce((s, e) => s + e.amount_paise, 0);

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const subMap = new Map(subs.map((s) => [s.id, s.name]));

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExps) {
      const k = e.category_id ?? "Uncategorised";
      map.set(k, (map.get(k) ?? 0) + e.amount_paise);
    }
    return [...map.entries()]
      .map(([id, amt]) => ({ id, name: catMap.get(id) ?? "Uncategorised", amt }))
      .sort((a, b) => b.amt - a.amt);
  }, [monthExps, catMap]);

  const recent = exps.slice(0, 6);
  const maxCat = byCat[0]?.amt ?? 1;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{dayjs().format("MMMM YYYY")}</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tabular-nums">{formatINR(total)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Today <span className="text-foreground tabular-nums">{formatINR(todayTotal)}</span>
            </p>
          </div>
          <Link
            to="/add"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            + Add
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">By category</h2>
          <span className="text-xs text-muted-foreground">{monthExps.length} entries</span>
        </div>
        {byCat.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No expenses yet this month.</p>
        ) : (
          <ul className="space-y-3">
            {byCat.slice(0, 6).map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatINR(c.amt)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(c.amt / maxCat) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent</h2>
          <Link to="/expenses" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            Tap <span className="text-primary font-semibold">Add</span> to record your first expense.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {catMap.get(e.category_id ?? "") ?? "Uncategorised"}
                    {e.subcategory_id ? <span className="text-muted-foreground"> · {subMap.get(e.subcategory_id)}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dayjs(e.spent_on).format("DD MMM")} {e.description ? `· ${e.description}` : ""}
                  </p>
                </div>
                <span className="ml-3 shrink-0 font-display text-base font-semibold tabular-nums">{formatINR(e.amount_paise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
