import { addDays, localDate, zonedToUtc } from "@/lib/time";

// Revisões agendadas: quando roda a próxima vez. Sempre no fuso da pessoa, no horário local escolhido.
export type Schedule = { schedule: "daily" | "weekly" | "monthly" | "once"; weekdays: number[]; runOn: string | null; time: string };

const at = (day: string, time: string, tz: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return zonedToUtc(y, m, d, h, min, tz);
};
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

// A primeira execução depois de `after`; null quando acabou (uma vez só que já passou)
export function nextAutomationRun(a: Schedule, tz: string, after: Date): Date | null {
  if (a.schedule === "once") {
    if (!a.runOn) return null;
    const t = at(a.runOn, a.time, tz);
    return t > after ? t : null;
  }
  const today = localDate(after, tz);
  if (a.schedule === "monthly") {
    // todo dia 1
    const [y, m] = today.split("-").map(Number);
    const thisMonth = at(`${y}-${String(m).padStart(2, "0")}-01`, a.time, tz);
    if (thisMonth > after) return thisMonth;
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return at(`${ny}-${String(nm).padStart(2, "0")}-01`, a.time, tz);
  }
  for (let i = 0; i < 9; i++) {
    const day = addDays(today, i);
    if (a.schedule === "weekly" && !a.weekdays.includes(weekdayOf(day))) continue;
    const t = at(day, a.time, tz);
    if (t > after) return t;
  }
  return null;
}
