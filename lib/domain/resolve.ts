import type { Recurrence, Transaction } from "@/lib/data/types";
import { dayIn, shiftMonth } from "@/lib/domain/money";

// "A resolver": contas fixas e entradas esperadas que venceram sem lançamento (atrasadas) ou vencem logo.
// Uma conta está resolvida no mês quando existe um lançamento ligado a ela naquele mês.

export type ToResolve = {
  recurrenceId: string;
  kind: Recurrence["kind"];
  description: string;
  amountCents: number;
  dueOn: string;                  // vencimento deste mês (ou do próximo, perto da virada)
  status: "late" | "today" | "soon";
  days: number;                   // dias de atraso (late) ou até o vencimento (soon)
};

const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

export function toResolve(recurrences: Recurrence[], transactions: Transaction[], today: string, horizonDays = 7): ToResolve[] {
  const month = today.slice(0, 7);
  const out: ToResolve[] = [];
  for (const r of recurrences) {
    if (!r.active) continue;
    const base = { recurrenceId: r.id, kind: r.kind, description: r.description, amountCents: r.amountCents };
    const settled = (m: string) => transactions.some((t) => t.recurrenceId === r.id && t.occurredOn.startsWith(m));
    const open = (due: string) => !r.createdOn || due >= r.createdOn;
    const due = dayIn(month, r.dayOfMonth);
    if (open(due) && !settled(month)) {
      const d = diffDays(due, today);
      if (d < 0) out.push({ ...base, dueOn: due, status: "late", days: -d });
      else if (d === 0) out.push({ ...base, dueOn: due, status: "today", days: 0 });
      else if (d <= horizonDays) out.push({ ...base, dueOn: due, status: "soon", days: d });
    }
    // perto do fim do mês, o vencimento do mês que vem também já entra
    const next = dayIn(shiftMonth(month, 1), r.dayOfMonth);
    const dn = diffDays(next, today);
    if (dn > 0 && dn <= horizonDays && open(next) && !settled(shiftMonth(month, 1))) out.push({ ...base, dueOn: next, status: "soon", days: dn });
  }
  const rank = { late: 0, today: 1, soon: 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.status === "late" ? b.days - a.days : a.days - b.days) || a.description.localeCompare(b.description, "pt-BR"));
}
