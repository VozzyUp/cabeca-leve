import type { Habit, HabitLog, Reminder, Task } from "@/lib/data/types";
import { localDate, zonedParts } from "@/lib/time";
import { habitStats } from "./habits";

export type DayItem = {
  id: string;
  kind: "reminder" | "task" | "habit";
  title: string;
  time: string | null;        // "HH:MM" local, null = sem horário
  done: boolean;
  overdue: boolean;
  href: string;
};

// Tudo que é de hoje: lembretes do dia, tarefas com prazo hoje ou atrasadas, hábitos planejados
export function dayItems(input: { reminders: Reminder[]; tasks: Task[]; habits: Habit[]; logs: HabitLog[]; now: Date; tz: string }): DayItem[] {
  const { now, tz } = input;
  const today = localDate(now, tz);
  const p = zonedParts(now, tz);
  const nowHm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const hm = (iso: string) => {
    const q = zonedParts(new Date(iso), tz);
    return `${String(q.hour).padStart(2, "0")}:${String(q.minute).padStart(2, "0")}`;
  };
  const items: DayItem[] = [];
  for (const r of input.reminders) {
    if (r.status !== "active" || !r.nextFireAt || localDate(new Date(r.nextFireAt), tz) !== today) continue;
    const time = hm(r.nextFireAt);
    items.push({ id: r.id, kind: "reminder", title: r.title, time, done: false, overdue: time < nowHm, href: "/lembretes" });
  }
  for (const t of input.tasks) {
    const dueToday = t.dueOn === today;
    const late = !!t.dueOn && t.dueOn < today && t.status !== "done";
    const doneToday = t.status === "done" && !!t.completedAt && localDate(new Date(t.completedAt), tz) === today;
    if (!dueToday && !late && !doneToday) continue;
    items.push({ id: t.id, kind: "task", title: t.title, time: null, done: t.status === "done", overdue: late, href: "/tarefas" });
  }
  for (const h of input.habits) {
    const s = habitStats(h, input.logs, today);
    if (!s.scheduledToday) continue;
    items.push({ id: h.id, kind: "habit", title: h.name, time: h.time, done: s.doneToday,
      overdue: !s.doneToday && !!h.time && h.time < nowHm, href: "/habitos" });
  }
  // com horário primeiro, em ordem; depois os sem horário (atrasados no topo)
  return items.sort((a, b) =>
    a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : Number(b.overdue) - Number(a.overdue));
}
