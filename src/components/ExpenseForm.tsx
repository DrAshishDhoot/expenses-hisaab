import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listCategories, listSubcategories, saveExpense, listExpenses } from "@/lib/sync";
import type { LocalCategory, LocalExpense, LocalSubcategory } from "@/lib/local-db";
import { rupeesToPaise, paiseToRupeesString } from "@/lib/format";
import { ChevronLeft } from "lucide-react";

export default function ExpenseForm({ expenseId }: { expenseId?: string }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };

  const [cats, setCats] = useState<LocalCategory[]>([]);
  const [subs, setSubs] = useState<LocalSubcategory[]>([]);
  const [editing, setEditing] = useState<LocalExpense | null>(null);

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [c, s] = await Promise.all([listCategories(user.id), listSubcategories(user.id)]);
      setCats(c);
      setSubs(s);
      if (expenseId) {
        const all = await listExpenses(user.id);
        const e = all.find((x) => x.id === expenseId);
        if (e) {
          setEditing(e);
          setAmount(paiseToRupeesString(e.amount_paise));
          setCategoryId(e.category_id ?? "");
          setSubcategoryId(e.subcategory_id ?? "");
          setDate(e.spent_on);
          setDescription(e.description ?? "");
        }
      } else if (c.length && !categoryId) {
        setCategoryId(c[0].id);
      }
    };
    void load();
  }, [user, expenseId]);

  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === categoryId), [subs, categoryId]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    const paise = rupeesToPaise(amount);
    if (paise <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      await saveExpense(user.id, {
        id: editing?.id,
        amount_paise: paise,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        description: description.trim() || null,
        spent_on: date,
      });
      toast.success(editing ? "Updated" : "Saved");
      nav({ to: search?.redirect ?? "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => nav({ to: "/" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="font-display text-2xl font-semibold">{editing ? "Edit expense" : "New expense"}</h1>

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <label className="block text-xs uppercase tracking-widest text-muted-foreground">Amount</label>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl text-muted-foreground">₹</span>
            <input
              autoFocus
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="w-full bg-transparent font-display text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <Field label="Category">
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">Uncategorised</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        {filteredSubs.length > 0 && (
          <Field label="Subcategory">
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">—</option>
              {filteredSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>

        <Field label="Note (optional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Lunch with team"
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Update expense" : "Save expense"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
