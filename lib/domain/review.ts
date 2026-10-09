import type { AutomationSource } from "@/lib/data/store";
import type { Budget, Category, Goal, Habit, HabitLog, Note, Project, Task, Transaction } from "@/lib/data/types";
import { budgetStatus } from "@/lib/domain/finance";
import { addDays, formatMoney, formatShortDate, localDate } from "@/lib/time";

// O que uma revisão agendada recebe para escrever o resumo: um texto curto e só com o que existe.
// Devolve null quando não há nada em nenhuma das fontes escolhidas (aí nem chama a IA).

export type ReviewData = {
  tasks: Task[]; projects: Project[]; habits: Habit[]; habitLogs: HabitLog[]; goals: Goal[];
  transactions: Transaction[]; categories: Category[]; budgets: Budget[]; notes: Note[];
};

const list = (items: string[], cap: number) => items.slice(0, cap).join("; ") + (items.length > cap ? `; e mais ${items.length - cap}` : "");
const dm = (day: string) => formatShortDate(day);

export function buildReviewContext(sources: AutomationSource[], d: ReviewData, o: { now: Date; tz: string; lookbackDays: number }): string | null {
  const today = localDate(o.now, o.tz);
  const from = addDays(today, -(o.lookbackDays - 1));
  const sections: string[] = [];
  const add = (title: string, lines: string[]) => { if (lines.length) sections.push(`${title}\n${lines.map((l) => `- ${l}`).join("\n")}`); };
  const has = (s: AutomationSource) => sources.includes(s);

  if (has("tasks")) {
    const open = d.tasks.filter((t) => t.status !== "done");
    const overdue = open.filter((t) => t.dueOn && t.dueOn < today);
    const dueToday = open.filter((t) => t.dueOn === today);
    const soon = open.filter((t) => t.dueOn && t.dueOn > today && t.dueOn <= addDays(today, 7));
    const done = d.tasks.filter((t) => t.status === "done" && t.completedAt && localDate(new Date(t.completedAt), o.tz) >= from);
    const lines: string[] = [];
    if (overdue.length) lines.push(`Atrasadas (${overdue.length}): ${list(overdue.map((t) => `${t.title} (era ${dm(t.dueOn!)})`), 10)}`);
    if (dueToday.length) lines.push(`Para hoje (${dueToday.length}): ${list(dueToday.map((t) => t.title), 10)}`);
    if (soon.length) lines.push(`Nos próximos 7 dias (${soon.length}): ${list(soon.map((t) => `${t.title} (${dm(t.dueOn!)})`), 10)}`);
    if (done.length) lines.push(`Concluídas nos últimos ${o.lookbackDays} dias (${done.length}): ${list(done.map((t) => t.title), 8)}`);
    add("Tarefas", lines);
  }

  if (has("projects")) {
    add("Projetos em andamento", d.projects.filter((p) => p.status === "active").slice(0, 8).map((p) => {
      const done = p.milestones.filter((m) => m.done).length;
      const next = p.milestones.find((m) => !m.done);
      return `${p.name}: ${done} de ${p.milestones.length} etapas${p.dueOn ? `, prazo ${dm(p.dueOn)}` : ""}${next ? `, próxima: ${next.title}` : ""}`;
    }));
  }

  if (has("habits")) {
    const days = Array.from({ length: o.lookbackDays }, (_, i) => addDays(from, i));
    add("Hábitos", d.habits.filter((h) => h.active).slice(0, 10).flatMap((h) => {
      const planned = days.filter((day) => h.weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())).length;
      if (!planned) return [];
      const logged = new Set(d.habitLogs.filter((l) => l.habitId === h.id && l.day >= from && l.day <= today).map((l) => l.day)).size;
      return [`${h.name}: ${logged} de ${planned} dias previstos`];
    }));
  }

  if (has("goals")) {
    add("Metas", d.goals.slice(0, 8).map((g) => {
      const pct = g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) : 0;
      const fmt = (v: number) => (g.unit === "money" ? formatMoney(v) : String(v));
      return `${g.title}: ${fmt(g.currentValue)} de ${fmt(g.targetValue)} (${pct}%)${g.dueOn ? `, prazo ${dm(g.dueOn)}` : ""}`;
    }));
  }

  if (has("finance")) {
    const inRange = d.transactions.filter((t) => t.occurredOn >= from && t.occurredOn <= today);
    const income = inRange.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0);
    const expenses = inRange.filter((t) => t.type === "expense");
    const spent = expenses.reduce((s, t) => s + t.amountCents, 0);
    const lines: string[] = [];
    if (inRange.length) {
      lines.push(`Nos últimos ${o.lookbackDays} dias: entrou ${formatMoney(income)}, saiu ${formatMoney(spent)}, sobra ${formatMoney(income - spent)}`);
      const byCat = new Map<string, number>();
      for (const t of expenses) {
        const c = d.categories.find((x) => x.id === t.categoryId);
        const top = c?.parentId ? d.categories.find((x) => x.id === c.parentId) ?? c : c;
        byCat.set(top?.name ?? "Sem categoria", (byCat.get(top?.name ?? "Sem categoria") ?? 0) + t.amountCents);
      }
      const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length) lines.push(`Onde mais gastou: ${top.map(([n, v]) => `${n} ${formatMoney(v)}`).join(", ")}`);
    }
    for (const s of budgetStatus(d.transactions, d.categories, d.budgets, today.slice(0, 7))) {
      if (s.level !== "ok") lines.push(`Teto de ${s.name}: ${formatMoney(s.spentCents)} de ${formatMoney(s.limitCents)} (${Math.round(s.ratio * 100)}%)`);
    }
    add("Dinheiro", lines);
  }

  if (has("notes")) {
    const recent = d.notes.filter((n) => n.kind === "note" && localDate(new Date(n.updatedAt), o.tz) >= from).map((n) => n.title || "(sem título)");
    add("Notas atualizadas", recent.length ? [list(recent, 8)] : []);
  }

  return sections.length ? sections.join("\n\n") : null;
}
