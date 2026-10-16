import { z } from "zod";

// Planos. O catálogo mora no banco (tabela plans, editada em Administração > Planos); aqui ficam o tipo,
// as contas puras (período, economia, limites) e os valores de partida, usados também quando não há banco (demonstração).

export const TRIAL_DAYS = 7;

export type Plan = {
  id: string;
  name: string;
  tagline: string | null;
  kind: "trial" | "paid";            // trial = teste grátis: não se vende e não tem preço
  priceCents: number;
  months: 1 | 3 | 6 | 12;            // quanto dura cada cobrança
  recurring: boolean;                // true: cartão que renova sozinho. false: pagamento único (Pix ou cartão) que vale `months` meses
  whatsappLimit: number;             // números de WhatsApp na conta (casal, família)
  messagesPerDay: number;
  storageMb: number;                 // espaço para documentos
  featured: boolean;                 // destaque na página de planos
  active: boolean;                   // à venda
  sort: number;
};

export const MONTHS_OPTIONS = [1, 3, 6, 12] as const;
export const MAX_WHATSAPP = 20;

// Valores de partida: o que valia antes de os planos irem para o banco
export const DEFAULT_PLANS: Plan[] = [
  { id: "trial", name: "Teste grátis", tagline: null, kind: "trial", priceCents: 0, months: 1, recurring: false, whatsappLimit: 1, messagesPerDay: 40, storageMb: 100, featured: false, active: true, sort: 0 },
  { id: "monthly", name: "Mensal", tagline: null, kind: "paid", priceCents: 3990, months: 1, recurring: true, whatsappLimit: 2, messagesPerDay: 200, storageMb: 2048, featured: false, active: true, sort: 10 },
  { id: "yearly", name: "Anual", tagline: null, kind: "paid", priceCents: 35900, months: 12, recurring: false, whatsappLimit: 3, messagesPerDay: 200, storageMb: 2048, featured: true, active: true, sort: 20 },
];

type Env = Record<string, string | undefined>;
const positive = (value: string | undefined) => {
  const n = Number((value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type PlanRow = {
  id: string; name: string; tagline: string | null; kind: string; price_cents: number; months: number; recurring: boolean;
  whatsapp_limit: number | null; messages_per_day: number | null; storage_mb: number | null; featured: boolean; active: boolean; sort: number;
};

// Limite em branco no banco = vale o que estava em Configuração do sistema (LIMIT_*) ou o padrão de antes: nada muda no deploy.
// Plano criado pela tela sempre grava os três números.
export function planFromRow(row: PlanRow, env: Env = process.env): Plan {
  const trial = row.kind === "trial";
  const whatsappKey = trial ? "LIMIT_WHATSAPP_TRIAL" : row.id === "yearly" ? "LIMIT_WHATSAPP_YEARLY" : "LIMIT_WHATSAPP_MONTHLY";
  const legacyWhatsapp = positive(env[whatsappKey]) ?? (trial ? 1 : row.id === "yearly" ? 3 : 2);
  const legacyMessages = positive(env[trial ? "LIMIT_DAILY_MESSAGES_TRIAL" : "LIMIT_DAILY_MESSAGES_PAID"]) ?? (trial ? 40 : 200);
  const legacyStorage = positive(env[trial ? "LIMIT_STORAGE_MB_TRIAL" : "LIMIT_STORAGE_MB_PAID"]) ?? (trial ? 100 : 2048);
  return {
    id: row.id, name: row.name, tagline: row.tagline, kind: trial ? "trial" : "paid", priceCents: row.price_cents,
    months: ([1, 3, 6, 12].includes(row.months) ? row.months : 1) as Plan["months"], recurring: row.recurring,
    whatsappLimit: Math.min(MAX_WHATSAPP, Math.floor(row.whatsapp_limit ?? legacyWhatsapp)),
    messagesPerDay: Math.floor(row.messages_per_day ?? legacyMessages), storageMb: Math.floor(row.storage_mb ?? legacyStorage),
    featured: row.featured, active: row.active, sort: row.sort,
  };
}

export const sortPlans = (plans: Plan[]) => [...plans].sort((a, b) => a.sort - b.sort || a.priceCents - b.priceCents);
export const forSale = (plans: Plan[]) => sortPlans(plans.filter((p) => p.kind === "paid" && p.active));
export const trialPlan = (plans: Plan[]): Plan => plans.find((p) => p.kind === "trial") ?? DEFAULT_PLANS[0];
export const planById = (plans: Plan[], id: string): Plan | undefined => plans.find((p) => p.id === id);

// O plano que vale para quem está em "trial" ou "none" é o do teste; para quem paga, o da assinatura (se sumiu, cai no teste)
export function planOfAccount(plans: Plan[], planId: string): Plan {
  return planId === "trial" || planId === "none" ? trialPlan(plans) : planById(plans, planId) ?? DEFAULT_PLANS.find((p) => p.id === planId) ?? trialPlan(plans);
}

export const isPaidPlanId = (plan: string) => plan !== "trial" && plan !== "none";

export const monthsText = (months: number) => (months === 1 ? "1 mês" : `${months} meses`);

// "por mês", "por ano", "a cada 3 meses", "por 6 meses"
export function planPeriod(p: Pick<Plan, "months" | "recurring">): string {
  if (p.recurring) return p.months === 1 ? "por mês" : p.months === 12 ? "por ano" : `a cada ${p.months} meses`;
  return p.months === 12 ? "por ano" : `por ${monthsText(p.months)}`;
}

// Texto do botão de cada plano: a forma de pagar se escolhe na tela seguinte
export const checkoutLabel = () => "Assinar";

export type PayMethod = "pix" | "boleto" | "card";
export const PAY_METHODS: PayMethod[] = ["pix", "boleto", "card"];
export const METHOD_NAME: Record<PayMethod, string> = { pix: "Pix", boleto: "Boleto", card: "Cartão de crédito" };

// Só o cartão de um plano que renova vira assinatura; Pix e boleto (e cartão em plano sem renovação) pagam um período
export const renewsWith = (p: Pick<Plan, "recurring">, method: PayMethod) => p.recurring && method === "card";

export function methodHint(p: Pick<Plan, "months" | "recurring">, method: PayMethod): string {
  const period = p.months === 1 ? "1 mês" : p.months === 12 ? "1 ano" : `${p.months} meses`;
  if (renewsWith(p, method)) return `Renova ${planPeriod(p)} no cartão. Cancele quando quiser.`;
  if (method === "pix") return `Aprovação na hora. Vale por ${period}, sem renovação automática.`;
  if (method === "boleto") return `Vence em 3 dias e libera quando o banco confirmar (1 a 2 dias úteis). Vale por ${period}.`;
  return `Um pagamento só, sem renovação automática. Vale por ${period}.`;
}

export const perMonthCents = (p: Pick<Plan, "priceCents" | "months">) => Math.round(p.priceCents / p.months);

// Quanto este plano economiza por mês contra o plano de 1 mês mais barato à venda (fração), ou null se não economiza
export function planSaving(p: Plan, plans: Plan[]): number | null {
  if (p.months === 1) return null;
  const base = forSale(plans).filter((x) => x.months === 1).sort((a, b) => a.priceCents - b.priceCents)[0];
  if (!base) return null;
  const saving = 1 - perMonthCents(p) / base.priceCents;
  return saving >= 0.01 ? saving : null;
}

export const waText = (n: number, long = false) => (n === 1 ? (long ? "1 número de WhatsApp" : "1 WhatsApp") : long ? `até ${n} números de WhatsApp (casal, família)` : `até ${n} WhatsApps`);

export function storageText(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1).replace(".", ",")} GB` : `${mb} MB`;
}

// Upgrade = deixa usar mais em algum limite sem diminuir nenhum; senão é só uma troca ("Trocar para este")
export function isUpgrade(from: Plan, to: Plan) {
  const pairs = [[from.whatsappLimit, to.whatsappLimit], [from.messagesPerDay, to.messagesPerDay], [from.storageMb, to.storageMb]];
  return pairs.every(([a, b]) => b >= a) && pairs.some(([a, b]) => b > a);
}

// ---- edição pelo time ----

export const slugify = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28).replace(/^[^a-z]+/, "");

export const planInput = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/).nullable(),   // nulo = plano novo: o id sai do nome
  name: z.string().trim().min(1, "Dê um nome ao plano.").max(40, "Nome grande demais (até 40 letras)."),
  tagline: z.string().trim().max(140, "A frase curta passa de 140 letras.").nullable(),
  priceCents: z.number().int().min(1, "O preço precisa ser maior que zero.").max(10_000_000, "Preço alto demais."),
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  recurring: z.boolean(),
  whatsappLimit: z.number().int().min(1, "Pelo menos 1 WhatsApp.").max(MAX_WHATSAPP, `No máximo ${MAX_WHATSAPP} WhatsApps.`),
  messagesPerDay: z.number().int().min(1, "Pelo menos 1 mensagem por dia.").max(100_000, "Mensagens por dia: até 100.000."),
  storageMb: z.number().int().min(1, "Pelo menos 1 MB.").max(1_048_576, "Espaço: até 1 TB."),
  featured: z.boolean(),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000),
});
export type PlanInput = z.infer<typeof planInput>;

// O teste grátis só muda de limite: não tem preço nem duração de cobrança
export const trialInput = z.object({
  whatsappLimit: planInput.shape.whatsappLimit,
  messagesPerDay: planInput.shape.messagesPerDay,
  storageMb: planInput.shape.storageMb,
});
export type TrialInput = z.infer<typeof trialInput>;

// "39,90", "R$ 1.299,00", "39.9" -> centavos; null se não for um valor
export function parseMoneyToCents(text: string): number | null {
  const t = text.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
