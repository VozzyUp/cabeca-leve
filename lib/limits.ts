import type { Settings } from "@/lib/data/types";

// Limites de uso por plano: protegem o custo da IA e o número de WhatsApp.
// Os valores vêm da configuração do admin (variáveis LIMIT_*); sem nada, valem os padrões abaixo.
export const DEFAULT_LIMITS = { trialMessages: 40, paidMessages: 200, costUsd: 2, perMinute: 12 } as const;

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

export function limitsFor(plan: Settings["plan"], env: Record<string, string | undefined> = process.env): Limits {
  const messages = plan === "trial" || plan === "none"
    ? Math.floor(positive(env.LIMIT_DAILY_MESSAGES_TRIAL) ?? DEFAULT_LIMITS.trialMessages)
    : Math.floor(positive(env.LIMIT_DAILY_MESSAGES_PAID) ?? DEFAULT_LIMITS.paidMessages);
  return { messagesPerDay: messages, costUsdPerDay: costCap(env.LIMIT_DAILY_COST_USD), perMinute: DEFAULT_LIMITS.perMinute };
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
