import type { Transaction } from "@/lib/data/types";
import { nextDate, toRRule } from "@/lib/domain/recurrence";
import { addDays, localDate, zonedToUtc } from "@/lib/time";

// Intérprete PROVISÓRIO de frases simples em português, só para a fatia vertical
// funcionar sem chave de API. O /replica-backend troca por Claude com ferramentas.

export type Intent =
  | { kind: "reminder"; title: string; at: Date; recurrenceRule: string | null }
  | { kind: "task"; title: string; dueOn: string | null; priority: "low" | "medium" | "high" }
  | { kind: "habit"; name: string; weekdays: number[]; time: string | null }
  | { kind: "transaction"; type: Transaction["type"]; amountCents: number; description: string;
      categoryName: string; paymentMethod: Transaction["paymentMethod"] };

const CATEGORY_WORDS: Array<[RegExp, string]> = [
  [/padaria|almo[cç]o|jantar|lanche|restaurante|caf[eé]|ifood|pizza/i, "Alimentação"],
  [/mercado|supermercado|feira|a[cç]ougue/i, "Mercado"],
  [/uber|99|t[aá]xi|[oô]nibus|metr[oô]|gasolina|combust[ií]vel|estacionamento|corrida/i, "Transporte"],
  [/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista|consulta/i, "Saúde"],
  [/aluguel|condom[ií]nio/i, "Moradia"],
  [/luz|[aá]gua|internet|g[aá]s|telefone/i, "Contas da casa"],
  [/cinema|show|bar|viagem|passeio/i, "Lazer"],
  [/curso|livro|escola|faculdade/i, "Educação"],
  [/netflix|spotify|assinatura|streaming/i, "Assinaturas"],
  [/roupa|sapato|loja|presente/i, "Compras"],
];

function paymentMethod(text: string): Transaction["paymentMethod"] {
  if (/\bpix\b/i.test(text)) return "pix";
  if (/cr[eé]dito|cart[aã]o/i.test(text)) return "credit";
  if (/d[eé]bito/i.test(text)) return "debit";
  if (/dinheiro|esp[eé]cie/i.test(text)) return "cash";
  return null;
}

function parseAmount(raw: string): number {
  // "35", "35,90", "1.250,00", "35.5"
  const clean = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Math.round(Number(clean) * 100);
}

// Sem \b: em JavaScript ele não reconhece letras acentuadas ("às", "amanhã") como palavra
const TIME = /(?<!\p{L})(?:[àa]s?|para as)\s*(\d{1,2})(?:(?::|h)(\d{2}))?\s*h?(?:oras)?(?!\p{L}|\d)/iu;
const DAY = /(?<!\p{L})(depois de amanh[aã]|amanh[aã]|hoje)(?!\p{L})/iu;

// Repetição de lembrete: "todo dia 5" (mensal), "todo dia", "toda segunda", "todas as sextas"
const MONTHLY = /(?<!\p{L})todo (?:m[eê]s(?: no)? )?dia (\d{1,2})(?!\d)/iu;
const DAILY = /(?<!\p{L})(?:todo dia|todos os dias|diariamente)(?!\p{L})/iu;
const WEEKLY = /(?<!\p{L})(?:toda|todas as)\s+((?:domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)s?(?:-feiras?)?(?:\s*(?:,|e)\s*(?:domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)s?(?:-feiras?)?)*)/iu;

function parseRepeat(clause: string, today: string): { rule: string; firstDay: string | null; strip: RegExp } | null {
  const monthly = clause.match(MONTHLY);
  if (monthly && Number(monthly[1]) >= 1 && Number(monthly[1]) <= 31) {
    const day = Number(monthly[1]);
    const [y, m] = today.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const thisMonth = `${today.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
    const nextM = new Date(Date.UTC(y, m, 1));
    const lastNext = new Date(Date.UTC(nextM.getUTCFullYear(), nextM.getUTCMonth() + 1, 0)).getUTCDate();
    const next = `${nextM.toISOString().slice(0, 8)}${String(Math.min(day, lastNext)).padStart(2, "0")}`;
    return { rule: toRRule({ freq: "monthly", interval: 1, monthDay: day }), firstDay: thisMonth >= today ? thisMonth : next, strip: MONTHLY };
  }
  if (DAILY.test(clause)) return { rule: toRRule({ freq: "daily", interval: 1 }), firstDay: null, strip: DAILY };
  const weekly = clause.match(WEEKLY);
  if (weekly) {
    const days = WEEKDAYS.filter(([re]) => re.test(weekly[1])).map(([, n]) => n);
    const [y, m, d] = today.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const ahead = Math.min(...days.map((t) => (t - wd + 7) % 7));
    return { rule: toRRule({ freq: "weekly", interval: 1, weekdays: days }), firstDay: addDays(today, ahead), strip: WEEKLY };
  }
  return null;
}

const nextAfter = (rule: string, day: string) => nextDate(rule, day, day) ?? addDays(day, 1);

function parseReminder(clause: string, now: Date, tz: string): Intent | null {
  if (!/\b(me )?lembr[ae]r?\b|\bme avis[ae]\b/i.test(clause)) return null;
  const time = clause.match(TIME);
  if (!time) return null;
  const hour = Number(time[1]);
  const minute = time[2] ? Number(time[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  const dayWord = clause.match(DAY)?.[1]?.toLowerCase();
  const today = localDate(now, tz);
  const repeat = parseRepeat(clause, today);
  let day = repeat?.firstDay ?? (dayWord?.startsWith("depois") ? addDays(today, 2) : dayWord?.startsWith("amanh") ? addDays(today, 1) : today);
  const [y, m, d] = day.split("-").map(Number);
  let at = zonedToUtc(y, m, d, hour, minute, tz);
  if (!dayWord && at <= now) {
    // horário que já passou: vale para a próxima ocorrência (amanhã, ou a próxima da repetição)
    day = repeat && repeat.firstDay ? nextAfter(repeat.rule, day) : addDays(day, 1);
    const [y2, m2, d2] = day.split("-").map(Number);
    at = zonedToUtc(y2, m2, d2, hour, minute, tz);
  }
  let title = clause
    .replace(TIME, " ").replace(DAY, " ").replace(repeat?.strip ?? /$^/, " ")
    .replace(/\b(e\s+)?(me\s+)?(lembr[ae]r?|avis[ae])\s*(de|do|da|dos|das)?\b/i, " ")
    .replace(/\s+/g, " ").trim().replace(/^(de|do|da|que|para)\s+/i, "").replace(/[.,!]+$/, "");
  if (!title) return null;
  title = title[0].toUpperCase() + title.slice(1);
  return { kind: "reminder", title, at, recurrenceRule: repeat?.rule ?? null };
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [/domingo/i, 0], [/segunda/i, 1], [/ter[cç]a/i, 2], [/quarta/i, 3], [/quinta/i, 4], [/sexta/i, 5], [/s[aá]bado/i, 6],
];

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Dia do prazo: hoje, amanhã, depois de amanhã, "até sexta" (próxima sexta, ou hoje se for sexta)
function parseDue(clause: string, now: Date, tz: string): string | null {
  const today = localDate(now, tz);
  const word = clause.match(DAY)?.[1]?.toLowerCase();
  if (word) return word.startsWith("depois") ? addDays(today, 2) : word.startsWith("amanh") ? addDays(today, 1) : today;
  const until = clause.match(/(?<!\p{L})(?:at[eé]|na|no|pra|para)\s+(?:a\s+|o\s+)?(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)/iu);
  if (until) {
    const target = WEEKDAYS.find(([re]) => re.test(until[1]))![1];
    const [y, m, d] = today.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDays(today, (target - wd + 7) % 7);
  }
  return null;
}

function parseTask(clause: string, now: Date, tz: string): Intent | null {
  const m = clause.match(/(?<!\p{L})(?:cri[ae]r?|adiciona|anota|coloca)\s+(?:uma\s+|a\s+)?tarefas?\s*(?:de|para|pra|:)?\s*(.+)$/iu);
  if (!m) return null;
  const priority = /urgente|important[ea]/i.test(clause) ? "high" : "medium";
  const title = m[1]
    .replace(DAY, " ")
    .replace(/(?<!\p{L})(?:at[eé]|na|no|pra|para)\s+(?:a\s+|o\s+)?(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?/iu, " ")
    .replace(/,?\s*(?:é\s+)?(urgente|importante)\b/iu, " ")
    .replace(/\s+/g, " ").trim().replace(/[.,!]+$/, "");
  if (!title) return null;
  return { kind: "task", title: capitalize(title), dueOn: parseDue(clause, now, tz), priority };
}

function parseHabit(clause: string): Intent | null {
  const explicit = clause.match(/(?<!\p{L})cri[ae]r?\s+(?:um\s+|o\s+)?h[aá]bito\s+(?:de\s+)?(.+)$/iu);
  const wish = clause.match(/(?<!\p{L})(?:quero|vou)\s+(?:come[cç]ar\s+a\s+)?(.+?)\s+(?:todo dia|todos os dias|toda\s|nas?\s+(?:segundas?|ter[cç]as?|quartas?|quintas?|sextas?|s[aá]bados?|domingos?))/iu);
  const body = explicit?.[1] ?? wish?.[1];
  if (!body) return null;
  const days = WEEKDAYS.filter(([re]) => re.test(clause)).map(([, n]) => n);
  const weekdays = /dias [uú]teis/i.test(clause) ? [1, 2, 3, 4, 5] : days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  const t = clause.match(TIME);
  const time = t ? `${t[1].padStart(2, "0")}:${t[2] ?? "00"}` : null;
  const name = body
    .replace(TIME, " ")
    .replace(/(?<!\p{L})(todo dia|todos os dias|nos dias [uú]teis|dias [uú]teis)(?!\p{L})/iu, " ")
    .replace(/\s+/g, " ").trim().replace(/[.,!]+$/, "");
  if (!name) return null;
  return { kind: "habit", name: capitalize(name), weekdays, time };
}

function parseTransaction(clause: string): Intent | null {
  const m = clause.match(
    /\b(gastei|paguei|comprei|recebi|ganhei)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|conto)?\s*(.*)$/i);
  if (!m) return null;
  const type: Transaction["type"] = /recebi|ganhei/i.test(m[1]) ? "income" : "expense";
  const amountCents = parseAmount(m[2]);
  if (!amountCents) return null;
  const rest = m[3]
    .replace(/\b(no|na|pelo|pela|via|com)?\s*(pix|cart[aã]o( de)? (cr[eé]dito|d[eé]bito)|cr[eé]dito|d[eé]bito|dinheiro)\b/gi, " ")
    .replace(/^\s*(no|na|em|com|de|do|da|pra|para)\s+/i, "")
    .replace(/[.,!]+$/, "").replace(/\s+/g, " ").trim();
  const categoryName = type === "income"
    ? (/sal[aá]rio/i.test(clause) ? "Salário" : /freela/i.test(clause) ? "Freelance" : "Outras entradas")
    : CATEGORY_WORDS.find(([re]) => re.test(rest))?.[1] ?? "Outros gastos";
  const description = rest ? rest[0].toUpperCase() + rest.slice(1) : type === "income" ? "Entrada" : "Gasto";
  return { kind: "transaction", type, amountCents, description, categoryName, paymentMethod: paymentMethod(clause) };
}

// Separa "gastei 35 na padaria e me lembra do mercado às 18h" em pedidos
export function splitClauses(text: string): string[] {
  return text
    .split(/(?:[.;\n]+|,\s*|\s+e\s+)(?=\s*(?:me\s+lembr|me\s+avis|lembr|gastei|paguei|comprei|recebi|ganhei|hoje|amanh|cri[ae]|adiciona|anota|quero|vou\s))/i)
    .map((s) => s.trim()).filter(Boolean);
}

export function parseMessage(text: string, now: Date, tz: string): Intent[] {
  return splitClauses(text)
    .map((c) => parseReminder(c, now, tz) ?? parseTask(c, now, tz) ?? parseHabit(c) ?? parseTransaction(c))
    .filter((x): x is Intent => x !== null);
}

// "quero falar com uma pessoa", "me passa pro suporte", "atendimento humano"
const HUMAN = /\b(falar|conversar)\s+com\s+(uma\s+pessoa|um\s+humano|uma\s+humana|algu[eé]m\s+d[oe]\s+(time|suporte|voc[eê]s)|um\s+atendente|o\s+suporte)\b|\bpassa\s+(pro|para\s+o)\s+suporte\b|\b(suporte|atendimento)\s+humano\b|\bquero\s+(um\s+)?(humano|atendente)\b/i;
export const wantsHuman = (text: string) => HUMAN.test(text);
