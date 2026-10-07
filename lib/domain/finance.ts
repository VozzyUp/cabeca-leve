import type { Category, Transaction } from "@/lib/data/types";

export type FinanceSummary = {
  month: string;              // AAAA-MM
  incomeCents: number;
  expenseCents: number;
  leftoverCents: number;      // entrou menos saiu
  byCategory: Array<{ name: string; cents: number; share: number }>;
  dailyAverageCents: number;  // gasto médio por dia decorrido
};

export function financeSummary(transactions: Transaction[], categories: Category[], month: string, today: string): FinanceSummary {
  const inMonth = transactions.filter((t) => t.occurredOn.startsWith(month));
  const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0);
  const expenses = inMonth.filter((t) => t.type === "expense");
  const expense = expenses.reduce((s, t) => s + t.amountCents, 0);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of expenses) {
    const name = names.get(t.categoryId ?? "") ?? "Sem categoria";
    totals.set(name, (totals.get(name) ?? 0) + t.amountCents);
  }
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const elapsed = today.startsWith(month) ? Number(today.slice(8, 10)) : today > month ? daysInMonth : 0;
  return {
    month,
    incomeCents: income,
    expenseCents: expense,
    leftoverCents: income - expense,
    byCategory: [...totals.entries()]
      .map(([name, cents]) => ({ name, cents, share: expense ? cents / expense : 0 }))
      .sort((a, b) => b.cents - a.cents),
    dailyAverageCents: elapsed ? Math.round(expense / elapsed) : 0,
  };
}
