import type { Category, Recurrence, Transaction } from "@/lib/data/types";
import { formatMoney } from "@/lib/time";
import { dayIn, shiftMonth } from "./money";

// Termômetro de um gasto recém-lançado: como está a categoria no mês, comparada com o mesmo
// período do mês passado, e quantas vezes apareceu na semana. Vai junto do resultado da
// ferramenta para o assistente comentar (no tom escolhido) só quando os números pedirem.

export type SpendingPulse = {
  category: string;
  monthCents: number;
  previousSamePeriodCents: number;
  last7DaysCount: number;
  last7DaysCents: number;
  subscriptionsMonthlyCents?: number;
  subscriptionsCount?: number;
  signals: string[];   // fatos já calculados que valem um comentário; vazio = nada a dizer
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function spendingPulse(input: {
  transactions: Transaction[]; categories: Category[]; recurrences: Recurrence[]; categoryId: string; today: string;
}): SpendingPulse | null {
  const { transactions, categories, recurrences, today } = input;
  const picked = categories.find((c) => c.id === input.categoryId);
  if (!picked || picked.kind !== "expense") return null;
  // subcategoria conta junto com a de cima ("iFood" dentro de "Alimentação")
  const root = picked.parentId ? categories.find((c) => c.id === picked.parentId) ?? picked : picked;
  const ids = new Set([root.id, ...categories.filter((c) => c.parentId === root.id).map((c) => c.id)]);
  const mine = transactions.filter((t) => t.type === "expense" && ids.has(t.categoryId ?? ""));
  const month = today.slice(0, 7);
  const prev = shiftMonth(month, -1);
  const prevUntil = dayIn(prev, Number(today.slice(8, 10)));
  const weekFrom = addDays(today, -6);
  const sum = (list: Transaction[]) => list.reduce((s, t) => s + t.amountCents, 0);
  const monthList = mine.filter((t) => t.occurredOn.startsWith(month) && t.occurredOn <= today);
  const prevList = mine.filter((t) => t.occurredOn.startsWith(prev) && t.occurredOn <= prevUntil);
  const week = mine.filter((t) => t.occurredOn >= weekFrom && t.occurredOn <= today);
  const pulse: SpendingPulse = {
    category: root.name, monthCents: sum(monthList), previousSamePeriodCents: sum(prevList),
    last7DaysCount: week.length, last7DaysCents: sum(week), signals: [],
  };

  // acima do mês passado: só conta com base de comparação e diferença que dá para sentir
  if (pulse.previousSamePeriodCents >= 5000 && pulse.monthCents >= pulse.previousSamePeriodCents * 1.3 && pulse.monthCents - pulse.previousSamePeriodCents >= 5000) {
    const pct = Math.round((pulse.monthCents / pulse.previousSamePeriodCents - 1) * 100);
    pulse.signals.push(`${root.name}: ${formatMoney(pulse.monthCents)} no mês, ${pct}% acima do mesmo período do mês passado (${formatMoney(pulse.previousSamePeriodCents)})`);
  }
  if (week.length >= 5) pulse.signals.push(`${week.length}º lançamento em ${root.name} nos últimos 7 dias (${formatMoney(pulse.last7DaysCents)})`);

  // assinaturas: o que já está fixo por mês nessa categoria
  const subs = recurrences.filter((r) => r.active && r.kind === "subscription" && ids.has(r.categoryId ?? ""));
  const isSubscriptions = /assinatura/i.test(root.name);
  if (subs.length || isSubscriptions) {
    const all = isSubscriptions ? recurrences.filter((r) => r.active && r.kind === "subscription") : subs;
    pulse.subscriptionsCount = all.length;
    pulse.subscriptionsMonthlyCents = all.reduce((s, r) => s + r.amountCents, 0);
    if (all.length >= 4 || pulse.subscriptionsMonthlyCents >= 15000) {
      pulse.signals.push(`${all.length} assinaturas ativas somando ${formatMoney(pulse.subscriptionsMonthlyCents)} por mês`);
    }
  }
  return pulse;
}
