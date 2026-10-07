// Datas no fuso do usuário. Todo instante é guardado em UTC (ISO); dias de calendário
// são "AAAA-MM-DD" no fuso do usuário.

export const DEFAULT_TZ = "America/Sao_Paulo";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

export function zonedParts(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), weekday: weekdays.indexOf(p.weekday),
  };
}

// Instante UTC correspondente a uma data/hora "de parede" no fuso indicado
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // diferença entre o que o fuso mostra para o palpite e o que queremos
  const shown = zonedParts(new Date(guess), tz);
  const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
  return new Date(guess - (shownUtc - guess));
}

export function localDate(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// "hoje", "amanhã", "ontem" ou "ter., 14 de out."
export function formatDayLabel(isoDay: string, now: Date, tz: string): string {
  const today = localDate(now, tz);
  if (isoDay === today) return "hoje";
  if (isoDay === addDays(today, 1)) return "amanhã";
  if (isoDay === addDays(today, -1)) return "ontem";
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

// Só a primeira letra maiúscula ("outubro de 2026" -> "Outubro de 2026"); o CSS capitalize erraria o "de"
export function capitalizeFirst(s: string): string {
  return s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
