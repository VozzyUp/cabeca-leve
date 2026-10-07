import type { Recurrence } from "@/lib/data/types";
import type { DayItem } from "./day";
import { nextOccurrence } from "./money";

export type Briefing = {
  greeting: string;
  summary: string;                    // uma frase com o essencial
  sections: Array<{ title: string; lines: string[] }>;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

// Resumo do dia em texto curto: compromissos, tarefas, hábitos e contas que vencem em até 3 dias.
// Hoje é montado por regras; no /replica-backend o Claude reescreve no tom escolhido em Ajustes.
export function buildBriefing(input: {
  name: string; hour: number; today: string; items: DayItem[]; recurrences: Recurrence[];
  monthSpentCents: number; lastMonthSamePeriodCents: number;
}): Briefing {
  const { items, today } = input;
  const greeting = `${input.hour < 12 ? "Bom dia" : input.hour < 18 ? "Boa tarde" : "Boa noite"}, ${input.name}.`;
  const events = items.filter((i) => i.kind === "event");
  const tasks = items.filter((i) => i.kind === "task" && !i.done);
  const late = tasks.filter((i) => i.overdue);
  const habits = items.filter((i) => i.kind === "habit");
  const reminders = items.filter((i) => i.kind === "reminder");
  const in3 = new Date(Date.parse(`${today}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
  const bills = input.recurrences
    .filter((r) => r.active && r.kind !== "income")
    .map((r) => ({ r, on: nextOccurrence(r.dayOfMonth, today) }))
    .filter(({ on }) => on <= in3)
    .sort((a, b) => a.on.localeCompare(b.on));

  const parts = [
    events.length ? plural(events.length, "compromisso", "compromissos") : null,
    tasks.length ? plural(tasks.length, "tarefa", "tarefas") : null,
    habits.length ? plural(habits.length, "hábito", "hábitos") : null,
    bills.length ? plural(bills.length, "conta para pagar", "contas para pagar") : null,
  ].filter(Boolean) as string[];
  const summary = parts.length
    ? `Hoje você tem ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0]}.`
    : "Dia livre: nada marcado, nenhuma tarefa e nenhuma conta vencendo.";

  const sections: Briefing["sections"] = [];
  if (events.length || reminders.length) {
    sections.push({ title: "Agenda", lines: [...events, ...reminders].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
      .map((i) => `${i.time} · ${i.title}${i.kind === "reminder" ? " (lembrete)" : ""}`) });
  }
  if (tasks.length) {
    sections.push({ title: "Tarefas", lines: [
      ...late.map((t) => `${t.title} (atrasada)`),
      ...tasks.filter((t) => !t.overdue).map((t) => t.title),
    ] });
  }
  if (habits.length) sections.push({ title: "Hábitos", lines: habits.map((h) => `${h.time ? `${h.time} · ` : ""}${h.title}${h.done ? " (feito)" : ""}`) });
  const money: string[] = bills.map(({ r, on }) => `${r.description}, ${brl(r.amountCents)}, vence ${on === today ? "hoje" : `dia ${Number(on.slice(8))}`}`);
  if (input.lastMonthSamePeriodCents > 0) {
    const diff = (input.monthSpentCents - input.lastMonthSamePeriodCents) / input.lastMonthSamePeriodCents;
    money.push(`No mês, ${brl(input.monthSpentCents)} em gastos do dia a dia, ${Math.abs(Math.round(diff * 100))}% ${diff >= 0 ? "acima" : "abaixo"} do mesmo período do mês passado.`);
  }
  if (money.length) sections.push({ title: "Dinheiro", lines: money });
  return { greeting, summary, sections };
}
