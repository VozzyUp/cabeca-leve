import type { Budget, Category, Transaction } from "@/lib/data/types";

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

// ---- Tetos de gastos (F5) ----
// O teto vale para a categoria e as subcategorias dela; o gasto é sempre somado dos lançamentos
// gravados (nunca conta feita pela IA).
export type BudgetStatus = { categoryId: string; name: string; limitCents: number; spentCents: number; ratio: number; level: "ok" | "near" | "over" };

export function budgetStatus(transactions: Transaction[], categories: Category[], budgets: Budget[], month: string): BudgetStatus[] {
  return budgets.flatMap((b) => {
    const cat = categories.find((c) => c.id === b.categoryId);
    if (!cat) return [];
    const ids = new Set([cat.id, ...categories.filter((c) => c.parentId === cat.id).map((c) => c.id)]);
    const spent = transactions.filter((t) => t.type === "expense" && t.occurredOn.startsWith(month) && ids.has(t.categoryId ?? ""))
      .reduce((s, t) => s + t.amountCents, 0);
    const ratio = spent / b.amountCents;
    return [{ categoryId: cat.id, name: cat.name, limitCents: b.amountCents, spentCents: spent, ratio, level: ratio >= 1 ? "over" : ratio >= 0.8 ? "near" : "ok" } as BudgetStatus];
  }).sort((a, b) => b.ratio - a.ratio);
}

// Aviso quando um gasto novo faz o teto cruzar 80% ou 100% (só na hora que cruza, não a cada gasto)
export function budgetAlert(s: BudgetStatus, addedCents: number): string | null {
  const before = (s.spentCents - addedCents) / s.limitCents;
  const pct = Math.round(s.ratio * 100);
  const money = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
  if (s.ratio >= 1 && before < 1) return `Passou do teto de ${s.name}: ${money(s.spentCents)} de ${money(s.limitCents)} (${pct}%).`;
  if (s.ratio >= 0.8 && before < 0.8) return `${s.name}: ${money(s.spentCents)} de ${money(s.limitCents)} (${pct}% do teto). Faltam ${money(s.limitCents - s.spentCents)}.`;
  return null;
}
