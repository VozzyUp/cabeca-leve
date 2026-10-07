import type { Category, CreditCard, InstallmentPurchase, Recurrence, Transaction } from "@/lib/data/types";

// Cálculos das telas de finanças do M3 (S19 a S23). Funções puras, testadas em money.test.ts.

export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const dayIn = (month: string, day: number) => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;

// ---- S19: gastos do dia a dia ----

export type VariableSpending = {
  month: string;
  totalCents: number;
  days: Array<{ day: string; cents: number }>;            // um ponto por dia do mês até hoje
  byCategory: Array<{ name: string; cents: number; count: number }>;
  dailyAverageCents: number;
  projectedCents: number;                                 // no ritmo atual, até o fim do mês
  previousMonthCents: number;                             // mesmo período do mês anterior
};

const isVariable = (t: Transaction) => t.type === "expense" && !t.recurrenceId;

export function variableSpending(transactions: Transaction[], categories: Category[], month: string, today: string): VariableSpending {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : daysInMonth(month);
  const inMonth = transactions.filter((t) => isVariable(t) && t.occurredOn.startsWith(month));
  const days = Array.from({ length: lastDay }, (_, i) => {
    const day = dayIn(month, i + 1);
    return { day, cents: inMonth.filter((t) => t.occurredOn === day).reduce((s, t) => s + t.amountCents, 0) };
  });
  const totals = new Map<string, { cents: number; count: number }>();
  for (const t of inMonth) {
    const name = names.get(t.categoryId ?? "") ?? "Sem categoria";
    const cur = totals.get(name) ?? { cents: 0, count: 0 };
    totals.set(name, { cents: cur.cents + t.amountCents, count: cur.count + 1 });
  }
  const total = inMonth.reduce((s, t) => s + t.amountCents, 0);
  const prev = shiftMonth(month, -1);
  const prevUntil = dayIn(prev, lastDay);
  return {
    month,
    totalCents: total,
    days,
    byCategory: [...totals.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cents - a.cents),
    dailyAverageCents: lastDay ? Math.round(total / lastDay) : 0,
    projectedCents: lastDay ? Math.round((total / lastDay) * daysInMonth(month)) : 0,
    previousMonthCents: transactions
      .filter((t) => isVariable(t) && t.occurredOn.startsWith(prev) && t.occurredOn <= prevUntil)
      .reduce((s, t) => s + t.amountCents, 0),
  };
}

// ---- S20: fixos ----

export function nextOccurrence(dayOfMonth: number, today: string): string {
  const month = today.slice(0, 7);
  const thisMonth = dayIn(month, dayOfMonth);
  return thisMonth >= today ? thisMonth : dayIn(shiftMonth(month, 1), dayOfMonth);
}

export type RecurringSummary = {
  items: Array<Recurrence & { nextOn: string; paidThisMonth: boolean }>;
  monthlyBillsCents: number;          // contas + assinaturas ativas
  monthlyIncomeCents: number;
  committedShare: number;             // fração da entrada fixa que já sai em fixos
};

export function recurringSummary(recurrences: Recurrence[], transactions: Transaction[], today: string): RecurringSummary {
  const month = today.slice(0, 7);
  const items = recurrences.map((r) => ({
    ...r,
    nextOn: nextOccurrence(r.dayOfMonth, today),
    paidThisMonth: transactions.some((t) => t.recurrenceId === r.id && t.occurredOn.startsWith(month)),
  }));
  const active = recurrences.filter((r) => r.active);
  const bills = active.filter((r) => r.kind !== "income").reduce((s, r) => s + r.amountCents, 0);
  const income = active.filter((r) => r.kind === "income").reduce((s, r) => s + r.amountCents, 0);
  return { items, monthlyBillsCents: bills, monthlyIncomeCents: income, committedShare: income ? bills / income : 0 };
}

// ---- S21: parcelas ----

export type InstallmentStatus = InstallmentPurchase & {
  monthlyCents: number;
  paid: number;                       // parcelas já lançadas até este mês
  remainingCents: number;
  lastMonth: string;                  // AAAA-MM da última parcela
  finished: boolean;
};

// Valor da parcela n (1..count): a última absorve o resto da divisão
export function installmentValue(p: InstallmentPurchase, n: number) {
  const base = Math.floor(p.totalCents / p.count);
  return n === p.count ? p.totalCents - base * (p.count - 1) : base;
}

export function installmentStatus(p: InstallmentPurchase, today: string): InstallmentStatus {
  const elapsed = monthsBetween(p.firstMonth, today.slice(0, 7)) + 1;
  const paid = Math.max(0, Math.min(p.count, elapsed));
  let remaining = 0;
  for (let n = paid + 1; n <= p.count; n++) remaining += installmentValue(p, n);
  return {
    ...p,
    monthlyCents: installmentValue(p, 1),
    paid,
    remainingCents: remaining,
    lastMonth: shiftMonth(p.firstMonth, p.count - 1),
    finished: paid >= p.count,
  };
}

// Quanto das parcelas cai em cada um dos próximos meses (para o gráfico de previsão)
export function installmentForecast(purchases: InstallmentPurchase[], today: string, months = 6) {
  const start = today.slice(0, 7);
  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(start, i);
    const cents = purchases.reduce((s, p) => {
      const n = monthsBetween(p.firstMonth, month) + 1;
      return n >= 1 && n <= p.count ? s + installmentValue(p, n) : s;
    }, 0);
    return { month, cents };
  });
}

// ---- S22: cartões ----

export type CardStatus = CreditCard & {
  invoiceCents: number;               // fatura aberta: compras do ciclo + parcelas do mês
  closesOn: string;
  dueOn: string;
  usedCents: number;                  // fatura aberta + parcelas futuras (o que ocupa o limite)
  availableCents: number;
};

export function cardStatus(card: CreditCard, transactions: Transaction[], purchases: InstallmentPurchase[], today: string): CardStatus {
  const month = today.slice(0, 7);
  const closesThisMonth = dayIn(month, card.closingDay);
  // o ciclo aberto fecha neste mês se hoje ainda não passou do fechamento; senão, no próximo
  const closesOn = today <= closesThisMonth ? closesThisMonth : dayIn(shiftMonth(month, 1), card.closingDay);
  const opensAfter = dayIn(shiftMonth(closesOn.slice(0, 7), -1), card.closingDay);
  const dueMonth = card.dueDay > card.closingDay ? closesOn.slice(0, 7) : shiftMonth(closesOn.slice(0, 7), 1);
  const invoiceMonth = closesOn.slice(0, 7);
  const purchasesInCycle = transactions
    .filter((t) => t.type === "expense" && t.cardId === card.id && t.occurredOn > opensAfter && t.occurredOn <= closesOn)
    .reduce((s, t) => s + t.amountCents, 0);
  const mine = purchases.filter((p) => p.cardId === card.id);
  const installmentsThisInvoice = mine.reduce((s, p) => {
    const n = monthsBetween(p.firstMonth, invoiceMonth) + 1;
    return n >= 1 && n <= p.count ? s + installmentValue(p, n) : s;
  }, 0);
  const future = mine.reduce((s, p) => {
    let sum = 0;
    for (let n = monthsBetween(p.firstMonth, invoiceMonth) + 2; n <= p.count; n++) if (n >= 1) sum += installmentValue(p, n);
    return s + sum;
  }, 0);
  const invoice = purchasesInCycle + installmentsThisInvoice;
  const used = invoice + future;
  return { ...card, invoiceCents: invoice, closesOn, dueOn: dayIn(dueMonth, card.dueDay), usedCents: used, availableCents: card.limitCents - used };
}

// ---- S23: análise de vários meses ----

export type MonthTotals = { month: string; incomeCents: number; expenseCents: number; fixedCents: number; variableCents: number };

export function monthlyTotals(transactions: Transaction[], today: string, months = 6): MonthTotals[] {
  const end = today.slice(0, 7);
  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(end, i - months + 1);
    const inMonth = transactions.filter((t) => t.occurredOn.startsWith(month));
    const sum = (f: (t: Transaction) => boolean) => inMonth.filter(f).reduce((s, t) => s + t.amountCents, 0);
    return {
      month,
      incomeCents: sum((t) => t.type === "income"),
      expenseCents: sum((t) => t.type === "expense"),
      fixedCents: sum((t) => t.type === "expense" && !!t.recurrenceId),
      variableCents: sum(isVariable),
    };
  });
}

// Média mensal por categoria nos meses fechados, e a variação do mês passado contra essa média
export function categoryTrends(transactions: Transaction[], categories: Category[], today: string, months = 5) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const current = today.slice(0, 7);
  const closed = Array.from({ length: months }, (_, i) => shiftMonth(current, -months + i));
  const last = closed[closed.length - 1];
  const totals = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const month = t.occurredOn.slice(0, 7);
    if (!closed.includes(month)) continue;
    const name = names.get(t.categoryId ?? "") ?? "Sem categoria";
    const byMonth = totals.get(name) ?? new Map<string, number>();
    byMonth.set(month, (byMonth.get(month) ?? 0) + t.amountCents);
    totals.set(name, byMonth);
  }
  return [...totals.entries()]
    .map(([name, byMonth]) => {
      const average = Math.round([...byMonth.values()].reduce((s, v) => s + v, 0) / months);
      const lastMonth = byMonth.get(last) ?? 0;
      return { name, averageCents: average, lastMonthCents: lastMonth, change: average ? (lastMonth - average) / average : 0 };
    })
    .sort((a, b) => b.averageCents - a.averageCents);
}
