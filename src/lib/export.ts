import * as XLSX from "xlsx";
import dayjs from "dayjs";
import type { LocalCategory, LocalExpense, LocalSubcategory } from "./local-db";

export function exportMonthly(
  expenses: LocalExpense[],
  categories: LocalCategory[],
  subcategories: LocalSubcategory[],
): void {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const subMap = new Map(subcategories.map((s) => [s.id, s.name]));
  const wb = XLSX.utils.book_new();

  const byMonth = new Map<string, LocalExpense[]>();
  for (const e of expenses) {
    const m = dayjs(e.spent_on).format("YYYY-MM");
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(e);
  }

  const months = [...byMonth.keys()].sort().reverse();
  if (months.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
  }

  for (const m of months) {
    const rows = byMonth.get(m)!.sort((a, b) => a.spent_on.localeCompare(b.spent_on));
    const data: (string | number)[][] = [["Date", "Category", "Subcategory", "Description", "Amount (₹)"]];
    let total = 0;
    for (const e of rows) {
      data.push([
        e.spent_on,
        catMap.get(e.category_id ?? "") ?? "",
        subMap.get(e.subcategory_id ?? "") ?? "",
        e.description ?? "",
        e.amount_paise / 100,
      ]);
      total += e.amount_paise;
    }
    data.push(["", "", "", "Total", total / 100]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, m);
  }

  const fname = `hisaab-${dayjs().format("YYYY-MM-DD")}.xlsx`;
  XLSX.writeFile(wb, fname);
}
