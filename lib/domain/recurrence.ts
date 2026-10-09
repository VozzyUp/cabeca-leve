import { addDays, zonedParts, zonedToUtc } from "@/lib/time";

// Repetição de lembretes e tarefas, guardada como RRULE (RFC 5545) num subconjunto simples:
//   FREQ=DAILY;INTERVAL=n
//   FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,WE,FR
//   FREQ=MONTHLY;INTERVAL=n;BYMONTHDAY=5
// Dia 31 em mês curto vira o último dia do mês. As contas são em dias locais (AAAA-MM-DD).

export type Repeat =
  | { freq: "daily"; interval: number }
  | { freq: "weekly"; interval: number; weekdays: number[] }   // 0 = domingo
  | { freq: "monthly"; interval: number; monthDay: number };

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function toRRule(r: Repeat): string {
  const interval = Math.max(1, Math.min(12, Math.round(r.interval)));
  if (r.freq === "daily") return `FREQ=DAILY;INTERVAL=${interval}`;
  if (r.freq === "weekly") return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${[...new Set(r.weekdays)].sort().map((d) => DAYS[d]).join(",")}`;
  return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${Math.max(1, Math.min(31, r.monthDay))}`;
}

export function parseRRule(rule: string | null | undefined): Repeat | null {
  if (!rule) return null;
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  if (parts.FREQ === "DAILY") return { freq: "daily", interval };
  if (parts.FREQ === "WEEKLY") {
    const weekdays = (parts.BYDAY ?? "").split(",").map((d) => DAYS.indexOf(d)).filter((d) => d >= 0);
    return weekdays.length ? { freq: "weekly", interval, weekdays } : null;
  }
  if (parts.FREQ === "MONTHLY") {
    const monthDay = Number(parts.BYMONTHDAY);
    return monthDay >= 1 && monthDay <= 31 ? { freq: "monthly", interval, monthDay } : null;
  }
  return null;
}

export function describeRepeat(rule: string | null | undefined): string | null {
  const r = parseRRule(rule);
  if (!r) return null;
  if (r.freq === "daily") return r.interval === 1 ? "todo dia" : `a cada ${r.interval} dias`;
  if (r.freq === "monthly") return `${r.interval === 1 ? "todo mês" : `a cada ${r.interval} meses`} no dia ${r.monthDay}`;
  const days = r.weekdays.length === 7 ? "todo dia"
    : r.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => r.weekdays.includes(d)) ? "dias úteis"
    : r.weekdays.map((d) => SHORT[d]).join(", ");
  return r.interval === 1 ? (days === "todo dia" || days === "dias úteis" ? days : `toda ${days}`) : `a cada ${r.interval} semanas: ${days}`;
}

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

// Próximo dia da repetição DEPOIS de `after`. `anchor` é a 1ª ocorrência (para os intervalos).
export function nextDate(rule: string, after: string, anchor: string): string | null {
  const r = parseRRule(rule);
  if (!r) return null;
  if (r.freq === "daily") {
    const passed = Math.max(0, daysBetween(anchor, after));
    return addDays(anchor, (Math.floor(passed / r.interval) + 1) * r.interval);
  }
  if (r.freq === "weekly") {
    const anchorWeekStart = addDays(anchor, -weekday(anchor));
    for (let d = addDays(after, 1), i = 0; i < 7 * r.interval * 2 + 7; i++, d = addDays(d, 1)) {
      const week = Math.floor(daysBetween(anchorWeekStart, d) / 7);
      if (r.weekdays.includes(weekday(d)) && week % r.interval === 0 && d >= anchor) return d;
    }
    return null;
  }
  const [ay, am] = anchor.split("-").map(Number);
  for (let k = 0; k < 600; k += r.interval) {
    const total = am - 1 + k;
    const y = ay + Math.floor(total / 12), m = (total % 12) + 1;
    const d = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(r.monthDay, lastDayOf(y, m))).padStart(2, "0")}`;
    if (d > after) return d;
  }
  return null;
}

// Data de aviso de um lembrete que volta a ficar ativo. O banco não aceita lembrete ativo sem data.
// Com a data guardada ao concluir: vale ela, se ainda está no futuro; se já passou e repete, a próxima ocorrência;
// se já passou e não repete, continua a mesma (aparece como atrasado). Sem data guardada (concluído antes de
// guardarmos): a próxima hora cheia, ou a próxima ocorrência da repetição a partir dela.
export function reopenFireAt(rule: string | null, current: string | null, tz: string, now: Date): string {
  if (current && new Date(current) > now) return current;
  const base = current ?? new Date(Math.ceil((now.getTime() + 60_000) / 3_600_000) * 3_600_000).toISOString();
  return (rule ? nextFireAt(rule, base, tz, now) : null) ?? base;
}

// Próximo aviso de um lembrete recorrente: mesmo horário local, primeira ocorrência depois de `now`
// (ocorrências perdidas, com o app desligado, não se acumulam).
export function nextFireAt(rule: string, currentFireAt: string, tz: string, now: Date): string | null {
  const p = zonedParts(new Date(currentFireAt), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const anchor = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  let day = anchor;
  for (let i = 0; i < 1000; i++) {
    const next = nextDate(rule, day, anchor);
    if (!next) return null;
    const [y, m, d] = next.split("-").map(Number);
    const at = zonedToUtc(y, m, d, p.hour, p.minute, tz);
    if (at > now) return at.toISOString();
    day = next;
  }
  return null;
}
