import type { Settings } from "@/lib/data/types";
import type { Plan } from "@/lib/plans";

// Limites de uso por plano: protegem o custo da IA e o número de WhatsApp.
// Mensagens, WhatsApps e espaço vêm do plano (Administração > Planos); o teto de custo da IA é um só para o sistema (LIMIT_DAILY_COST_USD).
export const DEFAULT_LIMITS = { costUsd: 2, perMinute: 12 } as const;

export type Limits = { messagesPerDay: number; costUsdPerDay: number | null; perMinute: number };

const positive = (value: string | undefined) => {
  const n = Number((value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Teto de custo: "0" ou "off" desliga; vazio usa o padrão
const costCap = (value: string | undefined) => {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "0" || v === "off") return null;
  return positive(v) ?? DEFAULT_LIMITS.costUsd;
};

export function limitsFor(plan: Pick<Plan, "messagesPerDay">, env: Record<string, string | undefined> = process.env): Limits {
  return { messagesPerDay: plan.messagesPerDay, costUsdPerDay: costCap(env.LIMIT_DAILY_COST_USD), perMinute: DEFAULT_LIMITS.perMinute };
}

export type Usage = { lastMinute: number; today: number; costTodayUsd: number };

// Devolve o texto para quem mandou, ou null se pode seguir
export function limitReply(plan: Settings["plan"], usage: Usage, limits: Limits): string | null {
  if (usage.lastMinute >= limits.perMinute) return "Muitas mensagens em pouco tempo. Espere um minutinho e mande de novo.";
  if (usage.today >= limits.messagesPerDay) {
    return plan === "trial"
      ? "Você chegou ao limite de mensagens de hoje do período de teste. Amanhã eu volto, ou assine um plano para ter mais espaço."
      : "Você chegou ao limite de mensagens de hoje. Amanhã eu volto com tudo.";
  }
  if (limits.costUsdPerDay !== null && usage.costTodayUsd >= limits.costUsdPerDay) return "Hoje já usei bastante do meu espaço com você. Amanhã eu volto com tudo. Se for urgente, peça para falar com uma pessoa.";
  return null;
}

// Quantos WhatsApps a conta pode vincular (casal, família): vem do plano
export const whatsappLimit = (plan: Pick<Plan, "whatsappLimit">) => plan.whatsappLimit;

// Espaço para guardar documentos (notas, recibos, pedidos): vem do plano, em megabytes
export const storageLimitBytes = (plan: Pick<Plan, "storageMb">) => Math.floor(plan.storageMb * 1024 * 1024);

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB`;
}
