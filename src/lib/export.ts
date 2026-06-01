import ExcelJS from "exceljs";
import dayjs from "dayjs";
import type { LocalCategory, LocalExpense, LocalSubcategory } from "./local-db";

export async function exportMonthly(
  expenses: LocalExpense[],
  categories: LocalCategory[],
  subcategories: LocalSubcategory[],
): Promise<void> {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const subMap = new Map(subcategories.map((s) => [s.id, s.name]));
  const wb = new ExcelJS.Workbook();

  const byMonth = new Map<string, LocalExpense[]>();
  for (const e of expenses) {
    const m = dayjs(e.spent_on).format("YYYY-MM");
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(e);
  }

  const months = [...byMonth.keys()].sort().reverse();
  if (months.length === 0) {
    const ws = wb.addWorksheet("Empty");
    ws.addRow(["No data"]);
  }

  for (const m of months) {
    const rows = byMonth.get(m)!.sort((a, b) => a.spent_on.localeCompare(b.spent_on));
    const ws = wb.addWorksheet(m);
    ws.addRow(["Date", "Category", "Subcategory", "Description", "Amount (₹)"]);
    let total = 0;
    for (const e of rows) {
      ws.addRow([
        e.spent_on,
        catMap.get(e.category_id ?? "") ?? "",
        subMap.get(e.subcategory_id ?? "") ?? "",
        e.description ?? "",
        e.amount_paise / 100,
      ]);
      total += e.amount_paise;
    }
    ws.addRow(["", "", "", "Total", total / 100]);
    ws.columns = [{ width: 12 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 12 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hisaab-${dayjs().format("YYYY-MM-DD")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
