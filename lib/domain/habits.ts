import type { Habit, HabitLog } from "@/lib/data/types";
import { addDays } from "@/lib/time";

export type HabitStats = {
  doneToday: boolean;
  scheduledToday: boolean;
  streak: number;   // dias planejados seguidos com registro, até hoje (hoje ainda em aberto não quebra)
  best: number;     // maior sequência registrada
  last7: Array<{ day: string; scheduled: boolean; done: boolean }>;
};

const weekday = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function habitStats(habit: Habit, logs: HabitLog[], today: string): HabitStats {
  const done = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.day));
  const scheduled = (day: string) => habit.weekdays.includes(weekday(day));
  const created = habit.createdAt.slice(0, 10);
  const first = [...done].sort()[0] ?? today;
  const start = first < created ? first : created;

  // percorre do início até hoje contando sequências só nos dias planejados
  let run = 0, best = 0;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (!scheduled(day)) continue;
    if (done.has(day)) { run++; best = Math.max(best, run); }
    else if (day !== today) run = 0;
  }
  return {
    doneToday: done.has(today),
    scheduledToday: scheduled(today),
    streak: run,
    best,
    last7: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { day, scheduled: scheduled(day), done: done.has(day) };
    }),
  };
}

// Constância de um hábito (S13): taxa nos últimos 30 dias e por dia da semana nos últimos 90.
// Hoje só conta se já foi feito, para não derrubar a taxa de manhã.
export function habitHistory(habit: Habit, logs: HabitLog[], today: string) {
  const done = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.day));
  const created = habit.createdAt.slice(0, 10);
  const counts = (days: number) => {
    let planned = 0, hits = 0;
    const byWeekday = Array.from({ length: 7 }, () => ({ planned: 0, done: 0 }));
    for (let i = days - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const wd = weekday(day);
      if (!habit.weekdays.includes(wd) || (day < created && !done.has(day))) continue;
      if (day === today && !done.has(day)) continue;
      planned++; byWeekday[wd].planned++;
      if (done.has(day)) { hits++; byWeekday[wd].done++; }
    }
    return { planned, hits, byWeekday };
  };
  const last30 = counts(30);
  const last90 = counts(90);
  return {
    total: done.size,
    rate30: last30.planned ? last30.hits / last30.planned : null,
    byWeekday: last90.byWeekday.map((w, wd) => ({ weekday: wd, planned: w.planned, rate: w.planned ? w.done / w.planned : null })),
  };
}
