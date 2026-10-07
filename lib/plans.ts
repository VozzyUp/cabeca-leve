// Planos à venda. Valores provisórios: o preço definitivo sai do /replica-entrepreneur.
export const PLANS = {
  monthly: { id: "monthly", name: "Mensal", priceCents: 3990, period: "por mês" },
  yearly: { id: "yearly", name: "Anual", priceCents: 35900, period: "por ano" },
} as const;

export const TRIAL_DAYS = 7;

// Quanto o anual economiza contra 12 mensalidades (fração)
export const yearlySaving = 1 - PLANS.yearly.priceCents / (PLANS.monthly.priceCents * 12);
