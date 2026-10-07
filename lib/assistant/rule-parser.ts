import type { Transaction } from "@/lib/data/types";
import { addDays, localDate, zonedToUtc } from "@/lib/time";

// Intérprete PROVISÓRIO de frases simples em português, só para a fatia vertical
// funcionar sem chave de API. O /replica-backend troca por Claude com ferramentas.

export type Intent =
  | { kind: "reminder"; title: string; at: Date }
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

function parseReminder(clause: string, now: Date, tz: string): Intent | null {
  if (!/\b(me )?lembr[ae]r?\b|\bme avis[ae]\b/i.test(clause)) return null;
  const time = clause.match(TIME);
  if (!time) return null;
  const hour = Number(time[1]);
  const minute = time[2] ? Number(time[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  const dayWord = clause.match(DAY)?.[1]?.toLowerCase();
  const today = localDate(now, tz);
  let day = dayWord?.startsWith("depois") ? addDays(today, 2) : dayWord?.startsWith("amanh") ? addDays(today, 1) : today;
  const [y, m, d] = day.split("-").map(Number);
  let at = zonedToUtc(y, m, d, hour, minute, tz);
  if (!dayWord && at <= now) {
    // horário que já passou hoje, sem dia dito: vale para amanhã
    day = addDays(today, 1);
    const [y2, m2, d2] = day.split("-").map(Number);
    at = zonedToUtc(y2, m2, d2, hour, minute, tz);
  }
  let title = clause
    .replace(TIME, " ").replace(DAY, " ")
    .replace(/\b(e\s+)?(me\s+)?(lembr[ae]r?|avis[ae])\s*(de|do|da|dos|das)?\b/i, " ")
    .replace(/\s+/g, " ").trim().replace(/^(de|do|da|que|para)\s+/i, "").replace(/[.,!]+$/, "");
  if (!title) return null;
  title = title[0].toUpperCase() + title.slice(1);
  return { kind: "reminder", title, at };
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
    .split(/(?:[.;\n]+|,\s*|\s+e\s+)(?=\s*(?:me\s+lembr|me\s+avis|lembr|gastei|paguei|comprei|recebi|ganhei|hoje|amanh))/i)
    .map((s) => s.trim()).filter(Boolean);
}

export function parseMessage(text: string, now: Date, tz: string): Intent[] {
  return splitClauses(text)
    .map((c) => parseReminder(c, now, tz) ?? parseTransaction(c))
    .filter((x): x is Intent => x !== null);
}
