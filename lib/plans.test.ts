import { describe, expect, it } from "vitest";
import { checkoutLabel, DEFAULT_PLANS, forSale, isUpgrade, parseMoneyToCents, perMonthCents, planFromRow, planInput, planOfAccount, planPeriod, planSaving, slugify, storageText, waText, type PlanRow } from "./plans";

const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "monthly", name: "Mensal", tagline: null, kind: "paid", price_cents: 3990, months: 1, recurring: true,
  whatsapp_limit: null, messages_per_day: null, storage_mb: null, featured: false, active: true, sort: 10, ...over,
});

describe("catálogo de planos", () => {
  it("limite em branco no banco vale o padrão de antes ou o que estava em Configuração", () => {
    expect(planFromRow(row(), {})).toMatchObject({ whatsappLimit: 2, messagesPerDay: 200, storageMb: 2048 });
    expect(planFromRow(row({ id: "yearly" }), {}).whatsappLimit).toBe(3);
    expect(planFromRow(row({ id: "trial", kind: "trial", price_cents: 0 }), {})).toMatchObject({ whatsappLimit: 1, messagesPerDay: 40, storageMb: 100 });
    const env = { LIMIT_DAILY_MESSAGES_PAID: "500", LIMIT_WHATSAPP_MONTHLY: "4", LIMIT_STORAGE_MB_PAID: "abc" };
    expect(planFromRow(row(), env)).toMatchObject({ whatsappLimit: 4, messagesPerDay: 500, storageMb: 2048 });
  });
  it("limite gravado no banco vale mais que a configuração antiga", () => {
    const p = planFromRow(row({ whatsapp_limit: 6, messages_per_day: 900, storage_mb: 10 }), { LIMIT_DAILY_MESSAGES_PAID: "500" });
    expect(p).toMatchObject({ whatsappLimit: 6, messagesPerDay: 900, storageMb: 10 });
  });
  it("só os planos pagos e ativos vão à venda, na ordem", () => {
    const plans = [...DEFAULT_PLANS, { ...DEFAULT_PLANS[1], id: "pro", sort: 5 }, { ...DEFAULT_PLANS[1], id: "velho", active: false }];
    expect(forSale(plans).map((p) => p.id)).toEqual(["pro", "monthly", "yearly"]);
  });
  it("quem está em teste ou sem plano vale pelo teste; quem paga, pelo plano (ou o teste, se o plano sumiu)", () => {
    expect(planOfAccount(DEFAULT_PLANS, "trial").id).toBe("trial");
    expect(planOfAccount(DEFAULT_PLANS, "none").id).toBe("trial");
    expect(planOfAccount(DEFAULT_PLANS, "yearly").id).toBe("yearly");
    expect(planOfAccount(DEFAULT_PLANS, "sumiu").id).toBe("trial");
  });
  it("escreve o período e o botão de cada tipo de plano", () => {
    expect(planPeriod({ months: 1, recurring: true })).toBe("por mês");
    expect(planPeriod({ months: 12, recurring: false })).toBe("por ano");
    expect(planPeriod({ months: 3, recurring: true })).toBe("a cada 3 meses");
    expect(planPeriod({ months: 6, recurring: false })).toBe("por 6 meses");
    expect(checkoutLabel({ months: 1, recurring: true })).toBe("Assinar no cartão");
    expect(checkoutLabel({ months: 12, recurring: false })).toBe("Pagar o ano (Pix ou cartão)");
    expect(checkoutLabel({ months: 3, recurring: false })).toBe("Pagar 3 meses (Pix ou cartão)");
  });
  it("calcula a economia contra o mensal mais barato; sem mensal ou sem economia, nada", () => {
    const [, monthly, yearly] = DEFAULT_PLANS;
    expect(perMonthCents(yearly)).toBe(2992);
    expect(Math.round(planSaving(yearly, DEFAULT_PLANS)! * 100)).toBe(25);
    expect(planSaving(monthly, DEFAULT_PLANS)).toBeNull();
    expect(planSaving(yearly, [yearly])).toBeNull();
    expect(planSaving({ ...yearly, priceCents: 3990 * 12 }, DEFAULT_PLANS)).toBeNull();
  });
  it("upgrade é mais limite sem perder nenhum", () => {
    const [, monthly, yearly] = DEFAULT_PLANS;
    expect(isUpgrade(monthly, yearly)).toBe(true);
    expect(isUpgrade(yearly, monthly)).toBe(false);
    expect(isUpgrade(monthly, { ...monthly, messagesPerDay: 1000 })).toBe(true);
    expect(isUpgrade(monthly, { ...monthly, messagesPerDay: 1000, storageMb: 10 })).toBe(false);
    expect(isUpgrade(monthly, { ...monthly, priceCents: 9900 })).toBe(false);
  });
  it("textos de limite", () => {
    expect(waText(1, true)).toBe("1 número de WhatsApp");
    expect(waText(3)).toBe("até 3 WhatsApps");
    expect(storageText(2048)).toBe("2 GB");
    expect(storageText(1536)).toBe("1,5 GB");
    expect(storageText(100)).toBe("100 MB");
  });
  it("lê preço digitado em reais", () => {
    expect(parseMoneyToCents("39,90")).toBe(3990);
    expect(parseMoneyToCents("R$ 1.299,00")).toBe(129900);
    expect(parseMoneyToCents("39.9")).toBe(3990);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("grátis")).toBeNull();
  });
  it("o id do plano novo sai do nome", () => {
    expect(slugify("Família Plus")).toBe("familia-plus");
    expect(slugify("  Pro!! ")).toBe("pro");
    expect(slugify("2024 Promo")).toBe("promo");
  });
  it("valida o que o time digita", () => {
    const ok = { id: null, name: "Família", tagline: null, priceCents: 5990, months: 1 as const, recurring: true, whatsappLimit: 5, messagesPerDay: 400, storageMb: 4096, featured: false, active: true, sort: 30 };
    expect(planInput.safeParse(ok).success).toBe(true);
    for (const bad of [{ name: "  " }, { priceCents: 0 }, { months: 2 }, { whatsappLimit: 21 }, { messagesPerDay: 0 }, { storageMb: 0 }, { id: "Ruim Id" }]) {
      expect(planInput.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
